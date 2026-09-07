// src/analysis/ensemble.ts - Multi-Model Ensemble Synthesizer
import {
  PoissonResult,
  DixonColesResult,
  EloResult,
  FormModelResult,
  HomeAwayModelResult,
  LeagueModelResult,
  XGModelResult,
  OddsModelResult,
} from '@/types';
import { analysisConfig } from '@/config/analysisConfig';

export interface ModelInputs {
  poisson?: PoissonResult;
  dixonColes?: DixonColesResult;
  elo?: EloResult;
  form?: FormModelResult;
  homeAway?: HomeAwayModelResult;
  league?: LeagueModelResult;
  xg?: XGModelResult;
  odds?: OddsModelResult;
}

export function synthesizeEnsemble(inputs: ModelInputs): Record<string, number> {
  const cfg = analysisConfig.weights;

  // Active models & normalized weights
  const activeWeights: Record<string, number> = {};
  let totalWeight = 0;

  if (inputs.poisson) { activeWeights.poisson = cfg.poisson; totalWeight += cfg.poisson; }
  if (inputs.dixonColes) { activeWeights.dixonColes = cfg.dixonColes; totalWeight += cfg.dixonColes; }
  if (inputs.elo) { activeWeights.elo = cfg.elo; totalWeight += cfg.elo; }
  if (inputs.form) { activeWeights.form = cfg.form; totalWeight += cfg.form; }
  if (inputs.homeAway) { activeWeights.homeAway = cfg.homeAway; totalWeight += cfg.homeAway; }
  if (inputs.league) { activeWeights.league = cfg.league; totalWeight += cfg.league; }
  if (inputs.xg?.available && inputs.xg.pHome !== undefined) {
    activeWeights.xg = 0.15;
    totalWeight += 0.15;
  }
  if (inputs.odds?.available) {
    activeWeights.odds = 0.10;
    totalWeight += 0.10;
  }

  // Renormalize weights
  const normWeights: Record<string, number> = {};
  for (const [k, w] of Object.entries(activeWeights)) {
    normWeights[k] = totalWeight > 0 ? w / totalWeight : 0;
  }

  // 1X2 Probabilities
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;

  if (inputs.poisson) {
    pHome += inputs.poisson.pHome * (normWeights.poisson || 0);
    pDraw += inputs.poisson.pDraw * (normWeights.poisson || 0);
    pAway += inputs.poisson.pAway * (normWeights.poisson || 0);
  }
  if (inputs.dixonColes) {
    pHome += inputs.dixonColes.pHome * (normWeights.dixonColes || 0);
    pDraw += inputs.dixonColes.pDraw * (normWeights.dixonColes || 0);
    pAway += inputs.dixonColes.pAway * (normWeights.dixonColes || 0);
  }
  if (inputs.elo) {
    pHome += inputs.elo.pHome * (normWeights.elo || 0);
    pDraw += inputs.elo.pDraw * (normWeights.elo || 0);
    pAway += inputs.elo.pAway * (normWeights.elo || 0);
  }
  if (inputs.form) {
    pHome += inputs.form.pHome * (normWeights.form || 0);
    pDraw += inputs.form.pDraw * (normWeights.form || 0);
    pAway += inputs.form.pAway * (normWeights.form || 0);
  }
  if (inputs.homeAway) {
    pHome += inputs.homeAway.pHome * (normWeights.homeAway || 0);
    pDraw += inputs.homeAway.pDraw * (normWeights.homeAway || 0);
    pAway += inputs.homeAway.pAway * (normWeights.homeAway || 0);
  }
  if (inputs.league) {
    pHome += inputs.league.homeWinRate * (normWeights.league || 0);
    pDraw += inputs.league.drawRate * (normWeights.league || 0);
    pAway += inputs.league.awayWinRate * (normWeights.league || 0);
  }
  if (inputs.xg?.available && inputs.xg.pHome !== undefined) {
    pHome += inputs.xg.pHome * (normWeights.xg || 0);
    pDraw += (inputs.xg.pDraw || 0.26) * (normWeights.xg || 0);
    pAway += (inputs.xg.pAway || 0.26) * (normWeights.xg || 0);
  }
  if (inputs.odds?.available) {
    pHome += inputs.odds.impliedHome * (normWeights.odds || 0);
    pDraw += inputs.odds.impliedDraw * (normWeights.odds || 0);
    pAway += inputs.odds.impliedAway * (normWeights.odds || 0);
  }

  // Normalize 1X2 so they sum strictly to 1.0
  const sum1X2 = pHome + pDraw + pAway;
  if (sum1X2 > 0) {
    pHome /= sum1X2;
    pDraw /= sum1X2;
    pAway /= sum1X2;
  }

  // Over/Under 2.5 Probabilities
  let pOver25 = 0;
  let ouWeight = 0;
  if (inputs.poisson) { pOver25 += inputs.poisson.pOver25 * 0.40; ouWeight += 0.40; }
  if (inputs.dixonColes) { pOver25 += inputs.dixonColes.pOver25 * 0.35; ouWeight += 0.35; }
  if (inputs.form) { pOver25 += inputs.form.pOver25 * 0.15; ouWeight += 0.15; }
  if (inputs.league) { pOver25 += inputs.league.over25Rate * 0.10; ouWeight += 0.10; }
  if (ouWeight > 0) pOver25 /= ouWeight;
  const pUnder25 = 1 - pOver25;

  // BTTS Probabilities
  let pBttsYes = 0;
  let bttsWeight = 0;
  if (inputs.poisson) { pBttsYes += inputs.poisson.pBttsYes * 0.40; bttsWeight += 0.40; }
  if (inputs.dixonColes) { pBttsYes += inputs.dixonColes.pBttsYes * 0.35; bttsWeight += 0.35; }
  if (inputs.form) { pBttsYes += inputs.form.pBttsYes * 0.15; bttsWeight += 0.15; }
  if (inputs.league) { pBttsYes += inputs.league.bttsRate * 0.10; bttsWeight += 0.10; }
  if (bttsWeight > 0) pBttsYes /= bttsWeight;
  const pBttsNo = 1 - pBttsYes;

  return {
    MS1: Number(pHome.toFixed(4)),
    X: Number(pDraw.toFixed(4)),
    MS2: Number(pAway.toFixed(4)),
    OVER_25: Number(pOver25.toFixed(4)),
    UNDER_25: Number(pUnder25.toFixed(4)),
    BTTS_YES: Number(pBttsYes.toFixed(4)),
    BTTS_NO: Number(pBttsNo.toFixed(4)),
  };
}
