// src/analysis/agreement.ts - Multi-Model Consensus, Dispersion & Agreement Engine
import { ModelAgreement } from '@/types';
import { analysisConfig } from '@/config/analysisConfig';

export function calculateAgreement(
  market: string,
  modelProbabilities: Record<string, number | undefined>
): ModelAgreement {
  // Filter only defined, valid numbers
  const entries = Object.entries(modelProbabilities).filter(
    ([_, val]) => val !== undefined && !isNaN(val) && val >= 0 && val <= 1
  ) as [string, number][];

  if (entries.length === 0) {
    return {
      market,
      mean: 0,
      median: 0,
      variance: 0,
      stdDev: 0,
      range: 0,
      divergenceScore: 1.0,
      isAgreementHigh: false,
      individualModelProbs: {},
    };
  }

  const values = entries.map(([_, v]) => v);
  const n = values.length;

  // Mean
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  // Median
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // Variance & StdDev
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Range
  const range = sorted[n - 1] - sorted[0];

  // Divergence score (0 = perfect unanimous agreement, 1 = maximum dispersion)
  // Scaled against maximum possible soccer dispersion
  const divergenceScore = Math.min(1.0, stdDev / 0.25);

  // Agreement threshold from config
  const isAgreementHigh = stdDev <= analysisConfig.thresholds.maxDispersionForSignal && range <= 0.30;

  const individualModelProbs: Record<string, number> = {};
  entries.forEach(([key, val]) => {
    individualModelProbs[key] = Number(val.toFixed(4));
  });

  return {
    market,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    variance: Number(variance.toFixed(5)),
    stdDev: Number(stdDev.toFixed(4)),
    range: Number(range.toFixed(4)),
    divergenceScore: Number(divergenceScore.toFixed(3)),
    isAgreementHigh,
    individualModelProbs,
  };
}
