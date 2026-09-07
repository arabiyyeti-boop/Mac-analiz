// src/analysis/homeAway.ts - Venue-Specific Home/Away Performance Engine
import { HomeAwayModelResult } from '@/types';

export function calculateHomeAway(params: {
  homeScoredAtHome: number;
  homeConcededAtHome: number;
  awayScoredAtAway: number;
  awayConcededAtAway: number;
  leagueAvgHomeScored?: number;
  leagueAvgAwayScored?: number;
}): HomeAwayModelResult {
  const lAvgHome = params.leagueAvgHomeScored || 1.52;
  const lAvgAway = params.leagueAvgAwayScored || 1.16;

  // Attack and defense strength ratios
  const homeAttackStr = Math.max(0.4, params.homeScoredAtHome / lAvgHome);
  const homeDefenseStr = Math.max(0.4, params.homeConcededAtHome / lAvgAway);

  const awayAttackStr = Math.max(0.4, params.awayScoredAtAway / lAvgAway);
  const awayDefenseStr = Math.max(0.4, params.awayConcededAtAway / lAvgHome);

  // Expected venue goals
  const homeExpected = Math.max(0.3, homeAttackStr * awayDefenseStr * lAvgHome);
  const awayExpected = Math.max(0.3, awayAttackStr * homeDefenseStr * lAvgAway);

  const goalDiff = homeExpected - awayExpected;

  // Draw probability estimation
  const pDraw = Math.max(0.18, Math.min(0.32, 0.28 * Math.exp(-Math.pow(goalDiff / 1.6, 2))));
  const remaining = 1 - pDraw;

  // Expected home win vs away win ratio
  const homeRatio = 1 / (1 + Math.exp(-(goalDiff * 1.3)));
  const pHome = remaining * homeRatio;
  const pAway = remaining * (1 - homeRatio);

  return {
    homeAdvantageFactor: Number((homeExpected / Math.max(0.1, awayExpected)).toFixed(2)),
    homeExpectedGoals: Number(homeExpected.toFixed(2)),
    awayExpectedGoals: Number(awayExpected.toFixed(2)),
    pHome: Number(pHome.toFixed(4)),
    pDraw: Number(pDraw.toFixed(4)),
    pAway: Number(pAway.toFixed(4)),
  };
}
