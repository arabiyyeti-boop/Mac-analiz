// server.ts - Full-Stack Express Server & Vite Middleware
import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { ApiOrchestrator } from './src/api/orchestrator/ApiOrchestrator';
import { NesineOddsProvider } from './src/api/providers/NesineOddsProvider';
import { MatchAnalysisEngine } from './src/analysis/engine';
import { AIExplanationService } from './src/ai/gemini';
import { canonicalEntityManager } from './src/entity/CanonicalEntityManager';
import { predictionSettlementService } from './src/prediction/settlement';
import { ClvEngine } from './src/analysis/clv';
import { predictionLedger } from './src/prediction/ledger';
import { APP_VERSION } from './src/config/analysisConfig';
import { ApiResponse } from './src/types';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for secure client IP resolution behind Cloud Run / Vercel reverse proxies
  app.set('trust proxy', 1);

  // 1. Controlled CORS Middleware
  const parseAllowedOrigins = (): Set<string> => {
    const set = new Set<string>();
    const envOrigins = process.env.ALLOWED_ORIGINS;
    if (envOrigins) {
      envOrigins.split(',').forEach((o) => {
        const trimmed = o.trim();
        if (trimmed) set.add(trimmed);
      });
    }
    // Controlled development origins (active in non-production environments)
    if (process.env.NODE_ENV !== 'production') {
      set.add('http://localhost:3000');
      set.add('http://localhost:5173');
      set.add('http://127.0.0.1:3000');
      set.add('http://127.0.0.1:5173');
    }
    return set;
  };

  const allowedOrigins = parseAllowedOrigins();

  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;

    if (origin) {
      const isAllowed =
        allowedOrigins.has(origin) ||
        process.env.NODE_ENV !== 'production' ||
        origin.endsWith('.run.app') ||
        origin.includes('ai.studio') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1');

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '86400');
      } else if (req.method === 'OPTIONS') {
        res.status(403).json({
          error: 'CORS_FORBIDDEN',
          message: 'Origin not allowed by CORS policy.',
        });
        return;
      }
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  // 2. Request Parsing & Base Security Headers
  app.use(express.json({ limit: '2mb' }));

  app.use((req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // 3. HTTP Cache Headers for Dynamic API Endpoints
  // Ensures browsers, CDNs, and intermediate proxies never serve stale match analysis or odds
  app.use('/api', (req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // 4. IP-Based Rate Limiting (In-Memory, Serverless-Safe)
  interface RateLimitEntry {
    count: number;
    resetTime: number;
  }

  function createRateLimiter(options: {
    windowMs: number;
    limit: number;
    scope: string;
    exemptPaths?: string[];
  }) {
    const store = new Map<string, RateLimitEntry>();
    const { windowMs, limit, scope, exemptPaths = [] } = options;

    return (req: Request, res: Response, next: () => void) => {
      // Exclude exempt paths (e.g., /api/health)
      if (exemptPaths.some((p) => req.path === p)) {
        return next();
      }

      // Determine client IP safely (IPv4 & IPv6 supported)
      let clientIp = req.ip;
      if (!clientIp) {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
          clientIp = forwarded.split(',')[0]?.trim();
        }
      }
      if (!clientIp) {
        clientIp = req.socket.remoteAddress || '127.0.0.1';
      }

      const now = Date.now();
      const key = `${scope}:${clientIp}`;

      // Serverless memory safeguard: opportunistic cleanup if store exceeds 2000 entries
      if (store.size > 2000) {
        for (const [k, v] of store.entries()) {
          if (v.resetTime <= now) {
            store.delete(k);
          }
        }
      }

      let entry = store.get(key);
      if (!entry || now >= entry.resetTime) {
        entry = {
          count: 1,
          resetTime: now + windowMs,
        };
        store.set(key, entry);
      } else {
        entry.count++;
      }

      const remaining = Math.max(0, limit - entry.count);
      const resetSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

      if (entry.count > limit) {
        res.setHeader('Retry-After', resetSeconds.toString());
        res.status(429).json({
          error: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        });
        return;
      }

      next();
    };
  }

  // Rate Limiter Configurations (overridable via environment variables)
  const apiRateLimitPerMinute = parseInt(process.env.API_RATE_LIMIT_PER_MINUTE || '60', 10) || 60;
  const analysisRateLimitPerMinute = parseInt(process.env.ANALYSIS_RATE_LIMIT_PER_MINUTE || '20', 10) || 20;

  // General API Rate Limiter (60 req/min/IP by default; exempts /api/health)
  const apiGeneralLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: apiRateLimitPerMinute,
    scope: 'api_general',
    exemptPaths: ['/api/health'],
  });
  const apiLimiter = apiGeneralLimiter;

  // Strict Rate Limiter for Heavy Computation (20 req/min/IP by default)
  const heavyAnalysisLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: analysisRateLimitPerMinute,
    scope: 'api_heavy_analysis',
  });

  // Protect all /api/* routes with the general limiter (exempts /api/health)
  app.use('/api', apiGeneralLimiter);

  const orchestrator = ApiOrchestrator.getInstance();

  // ----------------------------------------------------
  // API ROUTES
  // ----------------------------------------------------

  // Direct Project ZIP Download Endpoint
  app.get(['/download-project.zip', '/api/download-zip'], (req: Request, res: Response) => {
    const zipPath = path.join(process.cwd(), 'public', 'mac-analiz-pro-project.zip');
    res.download(zipPath, 'mac-analiz-pro-project.zip', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to download zip file' });
      }
    });
  });

  // 1. Health & Info
  app.get('/api/health', (req: Request, res: Response) => {
    const response: ApiResponse<{ status: string; version: string; time: string }> = {
      success: true,
      data: {
        status: 'healthy',
        version: APP_VERSION,
        time: new Date().toISOString(),
      },
      requestId: `req_${Date.now()}`,
    };
    res.json(response);
  });

  // 2. Providers Status & Diagnostics
  app.get('/api/providers/status', (req: Request, res: Response) => {
    const health = orchestrator.getProvidersHealth();
    const response: ApiResponse<typeof health> = {
      success: true,
      data: health,
      requestId: `req_${Date.now()}`,
    };
    res.json(response);
  });

  // 3. Today's Matches (Fixtures)
  app.get('/api/fixtures/today', async (req: Request, res: Response) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      if (!orchestrator.hasConfiguredProvider()) {
        const errResp: ApiResponse<any> = {
          success: false,
          error: {
            code: 'PROVIDER_UNCONFIGURED',
            message: 'Futbol veri sağlayıcısı yapılandırılmadı. Lütfen .env dosyasında FOOTBALL_DATA_ORG_KEY veya API_FOOTBALL_KEY tanımlayınız.',
            retryable: false,
          },
          requestId,
        };
        res.status(503).json(errResp);
        return;
      }

      const result = await orchestrator.getFixtures({ dateFrom: date, dateTo: date });

      const response: ApiResponse<any> = {
        success: true,
        data: result.matches,
        meta: {
          cached: result.cached,
          provider: result.provider,
          retrievedAt: result.retrievedAt,
          latencyMs: 0,
        },
        requestId,
      };
      res.json(response);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FIXTURES_FAILED',
          message: err.message || 'Maç bülteni alınırken bir hata oluştu.',
          retryable: true,
        },
        requestId,
      });
    }
  });

  // 4. Match Analysis Pipeline
  app.get('/api/match/:id/analysis', heavyAnalysisLimiter, async (req: Request, res: Response) => {
    const matchId = req.params.id;
    const requestId = `req_${Date.now()}_${matchId}`;

    try {
      if (!orchestrator.hasConfiguredProvider()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'PROVIDER_UNCONFIGURED',
            message: 'Futbol veri sağlayıcısı yapılandırılmadı.',
            retryable: false,
          },
          requestId,
        });
        return;
      }

      const matchData = await orchestrator.getMatchDetails(matchId);
      const targetMatch = matchData.details.match;

      // Section 86 & Gates: Retrieve odds data server-side and pass to FinalConsistencyCheck
      let verifiedOddsData: any = undefined;
      try {
        const nesine = NesineOddsProvider.getInstance();
        verifiedOddsData = await nesine.getOddsForMatch(
          matchId,
          targetMatch.homeTeam.name,
          targetMatch.awayTeam.name
        );
      } catch (err) {
        // If external provider is unreachable, proceed to consistency check with undefined or existing match odds
      }

      // Strict Final Consistency Check: verifies teams, fixture, stale odds, invalid odds before analysis
      const consistency = canonicalEntityManager.runFinalConsistencyCheck(
        targetMatch,
        matchData.details.h2h,
        verifiedOddsData,
        matchData.details.stats,
        matchData.details.squadData
      );

      if (!consistency.analysisPermitted) {
        res.status(422).json({
          success: false,
          error: {
            code: 'ANALYSIS_BLOCKED',
            message: `Veri ve kimlik bütünlüğü gerekçesiyle analiz engellendi: ${consistency.blockingReasons.join(' | ')}`,
            retryable: false,
          },
          requestId,
        });
        return;
      }

      // Attach verified odds to target match so analysis engine runs on verified odds
      if (verifiedOddsData && verifiedOddsData.status === 'CONNECTED' && consistency.oddsBindingValid) {
        const msMarket = verifiedOddsData.markets.find((m: any) => m.marketType === '1X2' || m.marketType === 'MS' || m.marketName === 'Maç Sonucu');
        if (msMarket) {
          const o1 = msMarket.outcomes.find((o: any) => o.name === '1' || o.outcomeName === '1')?.odd ?? msMarket.outcomes.find((o: any) => o.name === '1' || o.outcomeName === '1')?.odds;
          const oX = msMarket.outcomes.find((o: any) => o.name === 'X' || o.outcomeName === 'X')?.odd ?? msMarket.outcomes.find((o: any) => o.name === 'X' || o.outcomeName === 'X')?.odds;
          const o2 = msMarket.outcomes.find((o: any) => o.name === '2' || o.outcomeName === '2')?.odd ?? msMarket.outcomes.find((o: any) => o.name === '2' || o.outcomeName === '2')?.odds;
          if (o1 && oX && o2 && o1 > 1.01 && oX > 1.01 && o2 > 1.01) {
            targetMatch.odds = {
              homeWin: o1,
              draw: oX,
              awayWin: o2,
              bookmaker: 'Nesine',
              retrievedAt: verifiedOddsData.retrievedAt || new Date().toISOString(),
            };
          }
        }
      }

      const analysis = MatchAnalysisEngine.run({
        match: targetMatch,
        h2h: matchData.details.h2h,
        standing: matchData.details.standing,
        stats: matchData.details.stats,
        squadData: matchData.details.squadData,
      });

      if (!analysis.h2h && matchData.details.h2h) {
        analysis.h2h = matchData.details.h2h;
      }

      res.json({
        success: true,
        data: analysis,
        requestId,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: err.message || 'Maç analizi gerçekleştirilemedi.',
          retryable: true,
        },
        requestId,
      });
    }
  });

  // 5. AI Explanation Layer
  app.post('/api/ai/explain', heavyAnalysisLimiter, async (req: Request, res: Response) => {
    const requestId = `req_${Date.now()}_ai`;
    try {
      const analysis = req.body.analysis;
      if (!analysis || !analysis.match) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Doğrulanmış analiz verisi eksik.',
            retryable: false,
          },
          requestId,
        });
        return;
      }

      const explanation = await AIExplanationService.generateExplanation(analysis);
      res.json({
        success: true,
        data: explanation,
        requestId,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'AI_EXPLANATION_FAILED',
          message: 'AI açıklaması üretilemedi.',
          retryable: true,
        },
        requestId,
      });
    }
  });

  // 6. Nesine Status & Diagnostics
  app.get('/api/nesine/status', (req: Request, res: Response) => {
    const nesine = NesineOddsProvider.getInstance();
    const status = nesine.getStatus();
    res.json({
      success: true,
      data: status,
      requestId: `req_${Date.now()}_nesine_status`,
    });
  });

  // 7. Nesine Live Bulletin
  app.get('/api/nesine/bulletin', async (req: Request, res: Response) => {
    const requestId = `req_${Date.now()}_nesine_bulletin`;
    try {
      const nesine = NesineOddsProvider.getInstance();
      const events = await nesine.fetchBulletin();
      res.json({
        success: true,
        data: events.slice(0, 100), // Return top active football events
        meta: {
          count: events.length,
          source: 'Nesine.com',
          retrievedAt: new Date().toISOString(),
        },
        requestId,
      });
    } catch (err: any) {
      res.status(503).json({
        success: false,
        error: {
          code: 'NESINE_UNAVAILABLE',
          message: err.message || 'Nesine bülteni alınamadı.',
          retryable: true,
        },
        requestId,
      });
    }
  });

  // 8. Nesine Match Odds Query
  app.get('/api/nesine/odds', async (req: Request, res: Response) => {
    const matchId = (req.query.matchId as string) || `m_${Date.now()}`;
    const homeTeam = req.query.home as string;
    const awayTeam = req.query.away as string;
    const requestId = `req_${Date.now()}_odds`;

    if (!homeTeam || !awayTeam) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'Ev sahibi (home) ve deplasman (away) takım isimleri gereklidir.',
          retryable: false,
        },
        requestId,
      });
      return;
    }

    try {
      const nesine = NesineOddsProvider.getInstance();
      const oddsData = await nesine.getOddsForMatch(matchId, homeTeam, awayTeam);
      res.json({
        success: true,
        data: oddsData,
        requestId,
      });
    } catch (err: any) {
      res.status(503).json({
        success: false,
        error: {
          code: 'NESINE_UNAVAILABLE',
          message: err.message || 'Nesine oranlarına erişilemedi.',
          retryable: true,
        },
        requestId,
      });
    }
  });

  // 6. Automated Prediction Ledger Settlement (P1-4)
  // Evaluates pending predictions using verified final match results from orchestrator
  app.post('/api/predictions/settle', apiLimiter, async (req: Request, res: Response) => {
    const requestId = `settle_${Date.now()}`;
    try {
      const summary = await predictionSettlementService.settlePendingPredictions();
      res.json({
        success: true,
        data: summary,
        requestId,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SETTLEMENT_FAILED',
          message: err.message || 'Tahmin sonuçlandırma işlemi sırasında bir hata oluştu.',
          retryable: true,
        },
        requestId,
      });
    }
  });

  app.get('/api/predictions/settle', apiLimiter, async (req: Request, res: Response) => {
    const requestId = `settle_status_${Date.now()}`;
    try {
      const summary = await predictionSettlementService.settlePendingPredictions();
      res.json({
        success: true,
        data: summary,
        requestId,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SETTLEMENT_STATUS_FAILED',
          message: err.message || 'Tahmin sonuçlandırma durumu alınamadı.',
          retryable: true,
        },
        requestId,
      });
    }
  });

  // 7. Closing Line Value (CLV) Calculation & Tracking (P2-2)
  app.post('/api/predictions/clv/calculate', apiLimiter, async (req: Request, res: Response) => {
    const requestId = `clv_${Date.now()}`;
    const { predictionId, closingOdds, kickoffTimestamp, closingTimestamp } = req.body || {};

    if (!predictionId || !closingOdds) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CLV_PARAMS',
          message: 'predictionId ve closingOdds parametreleri zorunludur.',
          retryable: false,
        },
        requestId,
      });
      return;
    }

    try {
      const allRecords = await predictionLedger.getAllRecords();
      const record = allRecords.find((r) => r.predictionId === predictionId);

      if (!record) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PREDICTION_NOT_FOUND',
            message: 'Belirtilen tahmin kaydı bulunamadı.',
            retryable: false,
          },
          requestId,
        });
        return;
      }

      const clvRecord = ClvEngine.calculateClv({
        predictionId: record.predictionId,
        canonicalFixtureId: record.canonicalFixtureId,
        market: record.market,
        selection: record.selection,
        predictionOdds: record.oddsMarketSnapshot?.current ?? 2.0,
        closingOdds: Number(closingOdds),
        predictionTimestamp: record.createdAt,
        closingTimestamp: closingTimestamp || new Date().toISOString(),
        kickoffTimestamp: kickoffTimestamp || record.matchStartTime,
      });

      const updated = await predictionLedger.updateRecordClv(predictionId, clvRecord);

      res.json({
        success: true,
        data: {
          record: updated,
          clv: clvRecord,
        },
        requestId,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CLV_CALCULATION_FAILED',
          message: err.message || 'CLV hesaplaması sırasında bir hata oluştu.',
          retryable: false,
        },
        requestId,
      });
    }
  });

  // ----------------------------------------------------
  // VITE & STATIC SERVING
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`MAÇ ANALİZ PRO server running on port ${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('[Server Error]', err);
  });
}

startServer().catch((err) => {
  console.error('[Server Boot Error] Failed to start server:', err);
  process.exit(1);
});
