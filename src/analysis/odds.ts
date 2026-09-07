// src/analysis/odds.ts - Market Odds Overround Removal & Implied Probability Engine
import { CanonicalOdds, OddsModelResult } from '@/types';

export function calculateOddsModel(odds?: CanonicalOdds, modelHomeProb?: number, modelAwayProb?: number): OddsModelResult {
  if (!odds || !odds.homeWin || !odds.draw || !odds.awayWin || odds.homeWin <= 1 || odds.draw <= 1 || odds.awayWin <= 1) {
    return {
      available: false,
      bookmakerMargin: 0,
      impliedHome: 0,
      impliedDraw: 0,
      impliedAway: 0,
    };
  }

  // Raw implied probabilities
  const rawHome = 1 / odds.homeWin;
  const rawDraw = 1 / odds.draw;
  const rawAway = 1 / odds.awayWin;

  // Bookmaker overround margin (e.g. 1.05 = 5% juice)
  const sumRaw = rawHome + rawDraw + rawAway;
  const bookmakerMargin = Number((sumRaw - 1).toFixed(4));

  // Normalized fair probabilities
  const impliedHome = Number((rawHome / sumRaw).toFixed(4));
  const impliedDraw = Number((rawDraw / sumRaw).toFixed(4));
  const impliedAway = Number((rawAway / sumRaw).toFixed(4));

  // Value edge compared to model if model probs are passed
  const valueEdgeHome = modelHomeProb !== undefined ? Number((modelHomeProb - impliedHome).toFixed(4)) : undefined;
  const valueEdgeAway = modelAwayProb !== undefined ? Number((modelAwayProb - impliedAway).toFixed(4)) : undefined;

  return {
    available: true,
    bookmakerMargin,
    impliedHome,
    impliedDraw,
    impliedAway,
    valueEdgeHome,
    valueEdgeAway,
  };
}
