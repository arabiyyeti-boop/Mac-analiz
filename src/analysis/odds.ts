// src/analysis/odds.ts - Market Odds Overround Removal, Implied Probability & Value/EV Engine
import { CanonicalOdds, OddsModelResult } from '@/types';

/**
 * Validates a decimal odds value: must be a finite number strictly greater than 1.00.
 */
function isValidOdd(value?: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 1.0;
}

/**
 * Validates a probability value: must be a finite number strictly between 0 and 1.
 */
function isValidProbability(value?: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1.0;
}

/**
 * Helper to evaluate mathematical Value Edge, Expected Value (EV), and Kelly Criterion
 * for a specific 1X2 outcome.
 *
 * Rules:
 * - Value Edge = modelProbability - fairImpliedProbability
 * - Expected Value (EV) = (modelProbability * decimalOdds) - 1
 * - Positive EV Filter: strictly EV > 0 (guarded by floating-point epsilon 0.0001)
 * - EV <= 0 is strictly NOT positive EV and cannot produce a value signal
 * - Kelly Criterion is ONLY computed when EV > 0, odds > 1, and 0 < p < 1
 */
function evaluateOutcomeValue(
  modelProb?: number,
  decimalOdd?: number,
  fairProb?: number
): {
  valueEdge?: number;
  ev?: number;
  isPositiveEv: boolean;
  hasValue: boolean;
  kelly?: number;
  halfKelly?: number;
} {
  if (!isValidProbability(modelProb) || !isValidOdd(decimalOdd) || !isValidProbability(fairProb)) {
    return {
      valueEdge: undefined,
      ev: undefined,
      isPositiveEv: false,
      hasValue: false,
      kelly: undefined,
      halfKelly: undefined,
    };
  }

  // Floating-point precision epsilon
  const EPSILON = 0.0001;

  // 1. Value Edge (difference between model probability and bookmaker's de-vigged fair probability)
  const valueEdge = Number((modelProb - fairProb).toFixed(4));

  // 2. Expected Value (EV) = (p * odds) - 1
  const rawEv = (modelProb * decimalOdd) - 1;
  const ev = Number(rawEv.toFixed(4));

  // 3. Strict Positive EV filter: EV must be strictly positive
  const isPositiveEv = ev > EPSILON;

  // 4. Mathematical Value qualification: requires positive EV AND positive edge
  const hasValue = isPositiveEv && valueEdge > EPSILON;

  // 5. Kelly Criterion: f = (p * odds - 1) / (odds - 1) = EV / (odds - 1)
  let kelly: number | undefined = undefined;
  let halfKelly: number | undefined = undefined;

  if (isPositiveEv && decimalOdd > 1.0) {
    const netOdds = decimalOdd - 1.0;
    const f = rawEv / netOdds;

    if (Number.isFinite(f) && f > 0) {
      // Full Kelly capped at safe maximum 25% (0.25)
      kelly = Number(Math.min(0.25, f).toFixed(4));
      // Fractional Half-Kelly with strict risk cap at 5% (0.05)
      halfKelly = Number(Math.min(0.05, f * 0.5).toFixed(4));
    }
  }

  return {
    valueEdge,
    ev,
    isPositiveEv,
    hasValue,
    kelly,
    halfKelly,
  };
}

/**
 * Calculates bookmaker overround, fair probabilities, and comprehensive Value/EV metrics
 * for Home, Draw, and Away outcomes.
 *
 * Supports both 4-argument calls (odds, pHome, pDraw, pAway) and 3-argument legacy calls (odds, pHome, pAway).
 */
export function calculateOddsModel(
  odds?: CanonicalOdds,
  modelHomeProb?: number,
  modelDrawOrAwayProb?: number,
  modelAwayProb?: number
): OddsModelResult {
  // Resolve parameters to maintain backward compatibility with 3-arg callers
  let pHome: number | undefined;
  let pDraw: number | undefined;
  let pAway: number | undefined;

  if (modelAwayProb !== undefined) {
    // 4-argument call: (odds, pHome, pDraw, pAway)
    pHome = modelHomeProb;
    pDraw = modelDrawOrAwayProb;
    pAway = modelAwayProb;
  } else {
    // 3-argument legacy call: (odds, pHome, pAway)
    pHome = modelHomeProb;
    pDraw = undefined;
    pAway = modelDrawOrAwayProb;
  }

  // Pre-condition: All 3 odds must be valid finite numbers > 1.0
  if (
    !odds ||
    !isValidOdd(odds.homeWin) ||
    !isValidOdd(odds.draw) ||
    !isValidOdd(odds.awayWin)
  ) {
    return {
      available: false,
      bookmakerMargin: 0,
      impliedHome: 0,
      impliedDraw: 0,
      impliedAway: 0,
    };
  }

  const oddsHome = odds.homeWin;
  const oddsDraw = odds.draw;
  const oddsAway = odds.awayWin;

  // Raw implied probabilities: q = 1 / odds
  const rawHome = 1 / oddsHome;
  const rawDraw = 1 / oddsDraw;
  const rawAway = 1 / oddsAway;

  // Bookmaker overround sum (e.g. 1.054 = 5.4% juice/margin)
  const sumRaw = rawHome + rawDraw + rawAway;

  // Protect against non-finite or non-positive overround sum
  if (!Number.isFinite(sumRaw) || sumRaw <= 0) {
    return {
      available: false,
      bookmakerMargin: 0,
      impliedHome: 0,
      impliedDraw: 0,
      impliedAway: 0,
    };
  }

  const bookmakerMargin = Number((sumRaw - 1).toFixed(4));

  // Normalized fair probabilities (De-vigged: raw / sumRaw)
  const impliedHome = Number((rawHome / sumRaw).toFixed(4));
  const impliedDraw = Number((rawDraw / sumRaw).toFixed(4));
  const impliedAway = Number((rawAway / sumRaw).toFixed(4));

  // Calculate Value Edge, EV, and Kelly for all 3 outcomes on equal footing
  const homeVal = evaluateOutcomeValue(pHome, oddsHome, impliedHome);
  const drawVal = evaluateOutcomeValue(pDraw, oddsDraw, impliedDraw);
  const awayVal = evaluateOutcomeValue(pAway, oddsAway, impliedAway);

  return {
    available: true,
    bookmakerMargin,
    oddsHome,
    oddsDraw,
    oddsAway,
    rawImpliedHome: Number(rawHome.toFixed(4)),
    rawImpliedDraw: Number(rawDraw.toFixed(4)),
    rawImpliedAway: Number(rawAway.toFixed(4)),
    impliedHome,
    impliedDraw,
    impliedAway,
    valueEdgeHome: homeVal.valueEdge,
    valueEdgeDraw: drawVal.valueEdge,
    valueEdgeAway: awayVal.valueEdge,
    evHome: homeVal.ev,
    evDraw: drawVal.ev,
    evAway: awayVal.ev,
    isPositiveEvHome: homeVal.isPositiveEv,
    isPositiveEvDraw: drawVal.isPositiveEv,
    isPositiveEvAway: awayVal.isPositiveEv,
    hasValueHome: homeVal.hasValue,
    hasValueDraw: drawVal.hasValue,
    hasValueAway: awayVal.hasValue,
    kellyHome: homeVal.kelly,
    kellyDraw: drawVal.kelly,
    kellyAway: awayVal.kelly,
    halfKellyHome: homeVal.halfKelly,
    halfKellyDraw: drawVal.halfKelly,
    halfKellyAway: awayVal.halfKelly,
  };
}

/**
 * Calculates fair probabilities from home/draw/away decimal odds by removing bookmaker overround
 * using the standard multiplicative (proportional margin) method.
 */
export function calculateMultiplicativeFairProbabilities(
  home: number,
  draw: number,
  away: number
): { home: number; draw: number; away: number } {
  const rawHome = home > 1 ? 1 / home : 0;
  const rawDraw = draw > 1 ? 1 / draw : 0;
  const rawAway = away > 1 ? 1 / away : 0;
  const sum = rawHome + rawDraw + rawAway;
  if (sum <= 0) {
    return { home: 0.3333, draw: 0.3333, away: 0.3333 };
  }
  return {
    home: Number((rawHome / sum).toFixed(4)),
    draw: Number((rawDraw / sum).toFixed(4)),
    away: Number((rawAway / sum).toFixed(4)),
  };
}

