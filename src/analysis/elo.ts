// src/analysis/elo.ts - Team Strength Elo Rating Engine
import { EloResult } from '@/types';
import { analysisConfig } from '@/config/analysisConfig';

/**
 * Computes match probability from team Elo ratings with Home Advantage
 */
export function calculateElo(
  homeElo: number,
  awayElo: number,
  homeAdvantage: number = analysisConfig.elo.homeAdvantageElo
): EloResult {
  const adjustedHomeElo = homeElo + homeAdvantage;
  const eloDiff = adjustedHomeElo - awayElo;

  // Logistic expected win probability for Home: 1 / (1 + 10^(-eloDiff / 400))
  const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / 400));
  const expectedAway = 1 - expectedHome;

  // Draw probability estimation:
  // Draws are highest when teams are evenly matched (eloDiff = 0 ~ 28%) and decay as diff widens
  const maxDrawProb = 0.28;
  const drawDecayFactor = Math.exp(-Math.pow(eloDiff / 320, 2));
  const pDraw = Math.max(0.12, Math.min(0.32, maxDrawProb * drawDecayFactor));

  // Remaining probability distributed proportionally
  const remaining = 1 - pDraw;
  const rawSum = expectedHome + expectedAway;
  const pHome = (expectedHome / rawSum) * remaining;
  const pAway = (expectedAway / rawSum) * remaining;

  return {
    homeElo: Math.round(homeElo),
    awayElo: Math.round(awayElo),
    eloDiff: Math.round(eloDiff),
    pHome: Number(pHome.toFixed(4)),
    pDraw: Number(pDraw.toFixed(4)),
    pAway: Number(pAway.toFixed(4)),
  };
}

/**
 * Helper to derive baseline Elo from league standing / points per game
 */
export function deriveEloFromStanding(
  position: number,
  totalTeams = 20,
  pointsPerGame = 1.35
): number {
  const base = analysisConfig.elo.defaultLeagueElo;
  // Position scale: #1 is around 1750, middle #10 is 1500, bottom #20 is 1250
  const positionOffset = ((totalTeams / 2) - position) * 26;
  const ppgOffset = (pointsPerGame - 1.35) * 120;
  return Math.round(base + positionOffset + ppgOffset);
}
