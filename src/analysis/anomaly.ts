// src/analysis/anomaly.ts - Anomaly & Contradiction Detection Engine
import { AnomalyDetection, AnomalyItem, CanonicalMatch, CanonicalStats } from '@/types';

export class AnomalyEngine {
  static evaluate(params: {
    match: CanonicalMatch;
    probs1X2: { home: number; draw: number; away: number };
    stats?: CanonicalStats;
    sourceConflictWarning?: string;
  }): AnomalyDetection {
    const items: AnomalyItem[] = [];

    // Check 1: Probability Sum (Must sum to ~1.0 within epsilon 0.02)
    const sum1X2 = params.probs1X2.home + params.probs1X2.draw + params.probs1X2.away;
    if (Math.abs(sum1X2 - 1.0) > 0.025) {
      items.push({
        type: 'PROBABILITY_SUM',
        severity: 'BLOCKING',
        message: `Olasılık toplamı anormal: 1X2 toplamı ${(sum1X2 * 100).toFixed(1)}% (100% olmalı).`,
      });
    }

    // Check 2: Improbable extreme probability (>99.5% on standard soccer match)
    if (params.probs1X2.home > 0.99 || params.probs1X2.away > 0.99) {
      items.push({
        type: 'SUDDEN_OUTLIER',
        severity: 'HIGH',
        message: 'Aşırı uç model olasılığı tespit edildi (> %99). Futbol dinamiklerine aykırı varyans riski.',
      });
    }

    // Check 3: Stat anomalies if available
    if (params.stats) {
      if ((params.stats.possession ?? 0) < 0 || (params.stats.possession ?? 0) > 100) {
        items.push({
          type: 'IMPOSSIBLE_METRIC',
          severity: 'BLOCKING',
          message: 'Topa sahip olma oranı geçersiz aralıkta (< 0 veya > 100).',
        });
      }
    }

    // Check 4: Source conflict
    if (params.sourceConflictWarning) {
      items.push({
        type: 'SOURCE_CONFLICT',
        severity: 'MEDIUM',
        message: params.sourceConflictWarning,
      });
    }

    const blockingCount = items.filter((i) => i.severity === 'BLOCKING').length;

    return {
      hasAnomalies: items.length > 0,
      blockingAnomaliesCount: blockingCount,
      items,
    };
  }
}
