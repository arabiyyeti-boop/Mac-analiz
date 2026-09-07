// src/analysis/form.ts - Opponent-Adjusted, Recency-Weighted Form Engine
import { CanonicalForm, FormModelResult } from '@/types';

/**
 * Calculates exponential decay weight for match index (0 = most recent)
 */
function getRecencyWeight(index: number, alpha = 0.22): number {
  return Math.exp(-alpha * index);
}

export function calculateFormModel(
  homeForm?: CanonicalForm,
  awayForm?: CanonicalForm
): FormModelResult {
  // If either form is missing, return balanced defaults
  if (!homeForm || !awayForm || homeForm.last5.length === 0 || awayForm.last5.length === 0) {
    return {
      homeFormScore: 50,
      awayFormScore: 50,
      pHome: 0.44,
      pDraw: 0.28,
      pAway: 0.28,
      pOver25: 0.50,
      pBttsYes: 0.50,
    };
  }

  // Calculate recency-weighted points for home
  let homeWeightedPoints = 0;
  let homeWeightSum = 0;
  homeForm.last5.forEach((res, i) => {
    const w = getRecencyWeight(i);
    const pts = res === 'W' ? 3 : res === 'D' ? 1 : 0;
    homeWeightedPoints += pts * w;
    homeWeightSum += w;
  });
  const homeAvgWeighted = homeWeightSum > 0 ? (homeWeightedPoints / homeWeightSum) : 1.35;

  // Calculate recency-weighted points for away
  let awayWeightedPoints = 0;
  let awayWeightSum = 0;
  awayForm.last5.forEach((res, i) => {
    const w = getRecencyWeight(i);
    const pts = res === 'W' ? 3 : res === 'D' ? 1 : 0;
    awayWeightedPoints += pts * w;
    awayWeightSum += w;
  });
  const awayAvgWeighted = awayWeightSum > 0 ? (awayWeightedPoints / awayWeightSum) : 1.35;

  // Opponent-adjusted strength score (0 - 100)
  const homeScore = Math.min(100, Math.max(0, (homeAvgWeighted / 3) * 85 + (homeForm.opponentAdjustedRating * 15)));
  const awayScore = Math.min(100, Math.max(0, (awayAvgWeighted / 3) * 85 + (awayForm.opponentAdjustedRating * 15)));

  // Form win probabilities
  const scoreDiff = (homeScore - awayScore) / 100; // between -1 and +1
  const homeAdvantage = 0.08;

  const baseDraw = 0.27;
  const pDraw = Math.max(0.18, baseDraw - Math.abs(scoreDiff) * 0.1);
  const remaining = 1 - pDraw;

  // Logistic-like allocation of remaining probability
  const homeRatio = 1 / (1 + Math.exp(-((scoreDiff * 2.5) + homeAdvantage)));
  const pHome = remaining * homeRatio;
  const pAway = remaining * (1 - homeRatio);

  // Goal projections based on form goal averages
  const combinedScoring = (homeForm.goalsScoredAvg + awayForm.goalsScoredAvg) / 2;
  const pOver25 = Math.max(0.2, Math.min(0.85, (homeForm.over25Rate + awayForm.over25Rate) / 2));
  const pBttsYes = Math.max(0.2, Math.min(0.85, (homeForm.bttsRate + awayForm.bttsRate) / 2));

  return {
    homeFormScore: Number(homeScore.toFixed(1)),
    awayFormScore: Number(awayScore.toFixed(1)),
    pHome: Number(pHome.toFixed(4)),
    pDraw: Number(pDraw.toFixed(4)),
    pAway: Number(pAway.toFixed(4)),
    pOver25: Number(pOver25.toFixed(4)),
    pBttsYes: Number(pBttsYes.toFixed(4)),
  };
}
