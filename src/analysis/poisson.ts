// src/analysis/poisson.ts - Bivariate Poisson Match Probability Engine
import { PoissonResult } from '@/types';

/**
 * Computes Poisson Probability Mass Function: P(X = k) = (lambda^k * e^-lambda) / k!
 */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let factorial = 1;
  for (let i = 2; i <= k; i++) {
    factorial *= i;
  }
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
}

/**
 * Calculates Poisson model outcomes from expected team goals (lambdaHome, lambdaAway)
 */
export function calculatePoisson(lambdaHome: number, lambdaAway: number, maxGoals = 7): PoissonResult {
  // Ensure valid minimums
  const lHome = Math.max(0.2, Math.min(6.0, lambdaHome));
  const lAway = Math.max(0.2, Math.min(6.0, lambdaAway));

  const matrix: number[][] = [];
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver15 = 0;
  let pOver25 = 0;
  let pOver35 = 0;
  let pBttsYes = 0;
  let totalProbability = 0;

  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    const probH = poissonPmf(h, lHome);

    for (let a = 0; a <= maxGoals; a++) {
      const probA = poissonPmf(a, lAway);
      const cellProb = probH * probA;
      matrix[h][a] = cellProb;
      totalProbability += cellProb;

      // 1X2
      if (h > a) pHome += cellProb;
      else if (h === a) pDraw += cellProb;
      else pAway += cellProb;

      // Over/Under
      const totalGoals = h + a;
      if (totalGoals > 1.5) pOver15 += cellProb;
      if (totalGoals > 2.5) pOver25 += cellProb;
      if (totalGoals > 3.5) pOver35 += cellProb;

      // BTTS
      if (h > 0 && a > 0) pBttsYes += cellProb;
    }
  }

  // Normalize by totalProbability (which covers ~99.9% of distribution up to maxGoals)
  if (totalProbability > 0) {
    pHome /= totalProbability;
    pDraw /= totalProbability;
    pAway /= totalProbability;
    pOver15 /= totalProbability;
    pOver25 /= totalProbability;
    pOver35 /= totalProbability;
    pBttsYes /= totalProbability;
  }

  return {
    lambdaHome: Number(lHome.toFixed(3)),
    lambdaAway: Number(lAway.toFixed(3)),
    pHome: Number(pHome.toFixed(4)),
    pDraw: Number(pDraw.toFixed(4)),
    pAway: Number(pAway.toFixed(4)),
    pOver15: Number(pOver15.toFixed(4)),
    pUnder15: Number((1 - pOver15).toFixed(4)),
    pOver25: Number(pOver25.toFixed(4)),
    pUnder25: Number((1 - pOver25).toFixed(4)),
    pOver35: Number(pOver35.toFixed(4)),
    pUnder35: Number((1 - pOver35).toFixed(4)),
    pBttsYes: Number(pBttsYes.toFixed(4)),
    pBttsNo: Number((1 - pBttsYes).toFixed(4)),
    matrix,
  };
}
