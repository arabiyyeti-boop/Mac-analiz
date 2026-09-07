// src/analysis/dixonColes.ts - Dixon & Coles Low-Score Dependence Model
import { DixonColesResult } from '@/types';
import { poissonPmf } from './poisson';
import { analysisConfig } from '@/config/analysisConfig';

/**
 * Calculates Dixon-Coles tau factor for low scores: (0,0), (1,0), (0,1), (1,1)
 */
function getTau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) {
    return 1 - (lambda * mu * rho);
  } else if (x === 0 && y === 1) {
    return 1 + (lambda * rho);
  } else if (x === 1 && y === 0) {
    return 1 + (mu * rho);
  } else if (x === 1 && y === 1) {
    return 1 - rho;
  }
  return 1.0;
}

export function calculateDixonColes(
  lambdaHome: number,
  lambdaAway: number,
  rho: number = analysisConfig.dixonColes.rho,
  maxGoals = 7
): DixonColesResult {
  const lHome = Math.max(0.2, Math.min(6.0, lambdaHome));
  const lAway = Math.max(0.2, Math.min(6.0, lambdaAway));

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver25 = 0;
  let pBttsYes = 0;
  let totalProb = 0;

  for (let h = 0; h <= maxGoals; h++) {
    const rawH = poissonPmf(h, lHome);
    for (let a = 0; a <= maxGoals; a++) {
      const rawA = poissonPmf(a, lAway);
      const tau = getTau(h, a, lHome, lAway, rho);
      const adjustedProb = Math.max(0, rawH * rawA * tau);

      totalProb += adjustedProb;

      if (h > a) pHome += adjustedProb;
      else if (h === a) pDraw += adjustedProb;
      else pAway += adjustedProb;

      if (h + a > 2.5) pOver25 += adjustedProb;
      if (h > 0 && a > 0) pBttsYes += adjustedProb;
    }
  }

  // Normalization
  if (totalProb > 0) {
    pHome /= totalProb;
    pDraw /= totalProb;
    pAway /= totalProb;
    pOver25 /= totalProb;
    pBttsYes /= totalProb;
  }

  return {
    tauAdjustedHome: Number(lHome.toFixed(3)),
    tauAdjustedAway: Number(lAway.toFixed(3)),
    pHome: Number(pHome.toFixed(4)),
    pDraw: Number(pDraw.toFixed(4)),
    pAway: Number(pAway.toFixed(4)),
    pOver25: Number(pOver25.toFixed(4)),
    pUnder25: Number((1 - pOver25).toFixed(4)),
    pBttsYes: Number(pBttsYes.toFixed(4)),
    pBttsNo: Number((1 - pBttsYes).toFixed(4)),
    appliedRho: rho,
  };
}
