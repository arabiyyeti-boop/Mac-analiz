// server.ts - Full-Stack Express Server & Vite Middleware
import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { ApiOrchestrator } from './src/api/orchestrator/ApiOrchestrator';
import { MatchAnalysisEngine } from './src/analysis/engine';
import { AIExplanationService } from './src/ai/gemini';
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
      const analysis = MatchAnalysisEngine.run({
        match: matchData.details.match,
        h2h: matchData.details.h2h,
        standing: matchData.details.standing,
        stats: matchData.details.stats,
      });

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
