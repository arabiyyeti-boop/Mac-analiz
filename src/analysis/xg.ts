// src/analysis/xg.ts - Expected Goals (xG) Analysis Engine
import { XGModelResult } from '@/types';

/**
 * Evaluates xG metrics if available. Does NOT invent fake numbers.
 */
export function calculateXGModel(xgHome?: number, xgAway?: number): XGModelResult {
  if (xgHome === undefined || xgAway === undefined || isNaN(xgHome) || isNaN(xgAway)) {
    return {
      available: false,
    };
  }

  const xgDiff = Number((xgHome - xgAway).toFixed(2));

  // Estimate 1X2 probabilities based on xG difference
  // Typical soccer logistic mapping: +1.0 xG diff yields ~60% home win prob
  const pDraw = Math.max(0.18, Math.min(0.32, 0.27 * Math.exp(-Math.pow(xgDiff / 1.5, 2))));
  const remaining = 1 - pDraw;
  const homeRatio = 1 / (1 + Math.exp(-(xgDiff * 1.4)));

  const pHome = remaining * homeRatio;
  const pAway = remaining * (1 - homeRatio);

  return {
    available: true,
    xgHome: Number(xgHome.toFixed(2)),
    xgAway: Number(xgAway.toFixed(2)),
    xgDiff,
    pHome: Number(pHome.toFixed(4)),
    pDraw: Number(pDraw.toFixed(4)),
    pAway: Number(pAway.toFixed(4)),
  };
}
