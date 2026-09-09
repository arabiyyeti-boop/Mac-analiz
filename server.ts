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
import { APP_VERSION } from './src/config/analysisConfig';
import { ApiResponse } from './src/types';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '2mb' }));

  // Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  const orchestrator = ApiOrchestrator.getInstance();

  // ----------------------------------------------------
  // API ROUTES
  // ----------------------------------------------------

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
  app.get('/api/match/:id/analysis', async (req: Request, res: Response) => {
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
        verifiedOddsData
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
  app.post('/api/ai/explain', async (req: Request, res: Response) => {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MAÇ ANALİZ PRO server running on port ${PORT}`);
  });
}

startServer();
