// src/config/analysisConfig.ts - Centralized Configuration & Thresholds

export const APP_VERSION = '1.0.0';
export const ANALYSIS_VERSION = '1.0.0';
export const MODEL_VERSION = '1.0.0';
export const DATA_VERSION = '1.0.0';
export const CONFIG_VERSION = '1.0.0';
export const CALIBRATION_VERSION = '1.0.0';

export interface AnalysisConfig {
  // Ensemble Initial Model Weights (Sums to 1.0)
  weights: {
    poisson: number;
    dixonColes: number;
    elo: number;
    form: number;
    homeAway: number;
    league: number;
    xg: number;
    odds: number;
  };

  // Hard Risk Thresholds
  thresholds: {
    // Minimum data quality score required to produce a valid signal (0-100)
    minDataQualityForSignal: number;
    // Minimum model agreement score (0-100)
    minModelAgreementForSignal: number;
    // Maximum allowable dispersion / standard deviation among model probabilities
    maxDispersionForSignal: number;
    // Minimum model probability to qualify as candidate signal (e.g. 0.52 = 52%)
    minProbabilityForSignal: number;
    // Minimum confidence score (0-100)
    minConfidenceForSignal: number;
    // Minimum sample of matches for reliable form calculation
    minMatchesSample: number;
    // Maximum allowable data age in minutes before treated as STALE
    staleDataThresholdMinutes: number;
    // Minimum probability for 'VERY_STRONG' classification
    veryStrongProbThreshold: number;
    veryStrongConfidenceThreshold: number;
  };

  // Provider & Cache Policy
  cache: {
    fixturesTtlMs: number; // 10 minutes
    matchDetailsTtlMs: number; // 30 minutes
    analysisTtlMs: number; // 15 minutes
    rateLimitMaxRequestsPerMinute: number;
    providerTimeoutMs: number;
    circuitBreakerErrorThreshold: number;
    circuitBreakerCooldownMs: number;
  };

  // Dixon-Coles parameters
  dixonColes: {
    rho: number; // Correlation parameter for low scoring
  };

  // Elo rating parameters
  elo: {
    kFactor: number;
    homeAdvantageElo: number;
    defaultLeagueElo: number;
  };

  // League default goal expectations when league data is baseline
  leagueDefaults: {
    avgTotalGoals: number;
    homeWinRate: number;
    drawRate: number;
    awayWinRate: number;
    over25Rate: number;
    bttsRate: number;
  };
}

export const analysisConfig: AnalysisConfig = {
  weights: {
    poisson: 0.26,
    dixonColes: 0.18,
    elo: 0.18,
    form: 0.16,
    homeAway: 0.12,
    league: 0.10,
    xg: 0.00, // dynamically activated when xg is available
    odds: 0.00, // dynamically adjusted if real market odds available
  },
  thresholds: {
    minDataQualityForSignal: 55,
    minModelAgreementForSignal: 60,
    maxDispersionForSignal: 0.18,
    minProbabilityForSignal: 0.54,
    minConfidenceForSignal: 60,
    minMatchesSample: 5,
    staleDataThresholdMinutes: 60,
    veryStrongProbThreshold: 0.68,
    veryStrongConfidenceThreshold: 78,
  },
  cache: {
    fixturesTtlMs: 10 * 60 * 1000, // 10 mins
    matchDetailsTtlMs: 30 * 60 * 1000, // 30 mins
    analysisTtlMs: 15 * 60 * 1000, // 15 mins
    rateLimitMaxRequestsPerMinute: 30,
    providerTimeoutMs: 8000,
    circuitBreakerErrorThreshold: 3,
    circuitBreakerCooldownMs: 60000, // 1 min
  },
  dixonColes: {
    rho: -0.12, // typical empirical value for soccer match modeling
  },
  elo: {
    kFactor: 24,
    homeAdvantageElo: 90,
    defaultLeagueElo: 1500,
  },
  leagueDefaults: {
    avgTotalGoals: 2.68,
    homeWinRate: 0.44,
    drawRate: 0.27,
    awayWinRate: 0.29,
    over25Rate: 0.52,
    bttsRate: 0.51,
  },
};
