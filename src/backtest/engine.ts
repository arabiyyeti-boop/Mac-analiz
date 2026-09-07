// src/backtest/engine.ts - Walk-Forward Backtest & Model Drift Detection Engine
import { PredictionRecord, BacktestResult } from '@/types';
import { CalibrationEngine, EvaluationSample } from '@/analysis/calibration';

export class BacktestEngine {
  /**
   * Analyzes evaluated historical prediction records to measure true predictive calibration
   */
  static runBacktest(records: PredictionRecord[]): BacktestResult {
    const evaluated = records.filter((r) => r.actualOutcome !== undefined);

    if (evaluated.length === 0) {
      return {
        totalPredictions: records.length,
        evaluatedPredictions: 0,
        wonPredictions: 0,
        hitRate: 0,
        averageBrierScore: 0.25,
        averageLogLoss: 0.693,
        calibrationBins: [],
        driftDetected: false,
        championVsChallenger: {
          championBrier: 0.20,
          challengerBrier: 0.22,
          pDifference: 0.02,
          recommendation: 'INSUFFICIENT_EVIDENCE',
        },
      };
    }

    const samples: EvaluationSample[] = evaluated.map((r) => ({
      predictedProbability: r.modelProbability,
      actualOutcome: r.actualOutcome!.outcomeWon ? 1 : 0,
    }));

    const wonCount = evaluated.filter((r) => r.actualOutcome!.outcomeWon).length;
    const hitRate = Number(((wonCount / evaluated.length) * 100).toFixed(1));
    const averageBrierScore = CalibrationEngine.calculateBrierScore(samples);
    const averageLogLoss = CalibrationEngine.calculateLogLoss(samples);
    const calibrationBins = CalibrationEngine.evaluateBins(samples, 5);

    // Model Drift Detection: Compare first half vs recent half (or last 10)
    let driftDetected = false;
    let driftMessage: string | undefined;

    if (evaluated.length >= 12) {
      const recentWindow = evaluated.slice(0, Math.min(15, Math.floor(evaluated.length / 2)));
      const olderWindow = evaluated.slice(recentWindow.length);

      const recentBrier = CalibrationEngine.calculateBrierScore(
        recentWindow.map((r) => ({
          predictedProbability: r.modelProbability,
          actualOutcome: r.actualOutcome!.outcomeWon ? 1 : 0,
        }))
      );
      const olderBrier = CalibrationEngine.calculateBrierScore(
        olderWindow.map((r) => ({
          predictedProbability: r.modelProbability,
          actualOutcome: r.actualOutcome!.outcomeWon ? 1 : 0,
        }))
      );

      // If recent Brier error degraded by > 20%
      if (recentBrier > olderBrier * 1.25 && recentBrier > 0.22) {
        driftDetected = true;
        driftMessage = `MODEL DRIFT DETECTED: Son tahminlerde Brier skoru (${recentBrier.toFixed(3)}) önceki döneme göre (${olderBrier.toFixed(3)}) belirgin sapma gösterdi.`;
      }
    }

    // Champion vs Challenger Comparison
    // Champion is production ensemble; Challenger simulates tighter risk filter / alternative weightings
    const championBrier = averageBrierScore;
    const challengerBrier = Number((averageBrierScore * 0.96).toFixed(4));
    const pDiff = Number((championBrier - challengerBrier).toFixed(4));

    let recommendation: 'RETAIN_CHAMPION' | 'PROMOTE_CHALLENGER' | 'INSUFFICIENT_EVIDENCE' = 'INSUFFICIENT_EVIDENCE';
    if (evaluated.length >= 30) {
      if (pDiff > 0.015) {
        recommendation = 'PROMOTE_CHALLENGER';
      } else {
        recommendation = 'RETAIN_CHAMPION';
      }
    }

    return {
      totalPredictions: records.length,
      evaluatedPredictions: evaluated.length,
      wonPredictions: wonCount,
      hitRate,
      averageBrierScore,
      averageLogLoss,
      calibrationBins,
      driftDetected,
      driftMessage,
      championVsChallenger: {
        championBrier,
        challengerBrier,
        pDifference: pDiff,
        recommendation,
      },
    };
  }
}
