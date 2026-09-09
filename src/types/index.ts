// src/types/index.ts - Canonical Types and Contracts for MAÇ ANALİZ PRO

export type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED';

export interface CanonicalTeam {
  id: number | string;
  name: string;
  shortName: string;
  tla?: string;
  crest?: string;
}

export interface CanonicalLeague {
  id: number | string;
  name: string;
  code: string;
  country?: string;
  emblem?: string;
}

export interface CanonicalScore {
  fullTime: {
    home: number | null;
    away: number | null;
  };
  halfTime: {
    home: number | null;
    away: number | null;
  };
}

export interface CanonicalMatch {
  id: string;
  externalId: string;
  provider: string;
  utcDate: string;
  status: MatchStatus;
  minute?: number;
  homeTeam: CanonicalTeam;
  awayTeam: CanonicalTeam;
  league: CanonicalLeague;
  venue?: string;
  matchday?: number;
  score?: CanonicalScore;
  odds?: CanonicalOdds;
}

export interface CanonicalStats {
  possession?: number; // 0-100
  shotsTotal?: number;
  shotsOnTarget?: number;
  corners?: number;
  fouls?: number;
  yellowCards?: number;
  redCards?: number;
  xG?: number;
}

export interface CanonicalStanding {
  position: number;
  team: CanonicalTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string; // e.g. "WWDLW"
}

export type H2HStatus = 'AVAILABLE' | 'MISSING' | 'LOW_CONFIDENCE' | 'CONFLICTING';

export interface CanonicalH2H {
  status?: H2HStatus;
  matchesCount: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  totalGoals: number;
  avgGoals: number;
  recentMatches: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }>;
  source?: string;
  retrievedAt?: string;
  confidence?: number;
  dataQuality?: number;
}

export interface CanonicalForm {
  teamId: string | number;
  matchesPlayed: number;
  last5: ('W' | 'D' | 'L')[];
  last10: ('W' | 'D' | 'L')[];
  pointsPerGame: number;
  goalsScoredAvg: number;
  goalsConcededAvg: number;
  bttsRate: number; // 0 - 1
  over25Rate: number; // 0 - 1
  cleanSheetRate: number; // 0 - 1
  opponentAdjustedRating: number; // strength of schedule factor
}

export interface CanonicalInjury {
  player: string;
  teamId: string | number;
  reason: string;
  status: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE';
}

export interface CanonicalOdds {
  bookmaker: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  over25?: number;
  under25?: number;
  bttsYes?: number;
  bttsNo?: number;
  retrievedAt: string;
}

// Data Provenance & Freshness
export type FreshnessStatus = 'FRESH' | 'RECENT' | 'STALE' | 'UNAVAILABLE';

export interface DataProvenance {
  source: string;
  provider: string;
  retrievedAt: string;
  updatedAt?: string;
  effectiveAt: string;
  freshness: FreshnessStatus;
  validationStatus: 'VALIDATED' | 'SEMANTIC_FAIL' | 'SOURCE_CONFLICT' | 'INSUFFICIENT';
}

export interface DataQualityReport {
  score: number; // 0 - 100
  factors: {
    sampleSufficiency: number;
    freshnessScore: number;
    h2hCoverage: number;
    leagueBaselineCoverage: number;
    providerReliability: number;
    xgAvailability: number;
    injuryDataAvailability: number;
  };
  warnings: string[];
  isSufficientForAnalysis: boolean;
}

// Model outputs
export interface PoissonResult {
  lambdaHome: number;
  lambdaAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver15: number;
  pUnder15: number;
  pOver25: number;
  pUnder25: number;
  pOver35: number;
  pUnder35: number;
  pBttsYes: number;
  pBttsNo: number;
  matrix: number[][]; // 0-7 x 0-7 score probabilities
}

export interface DixonColesResult {
  tauAdjustedHome: number;
  tauAdjustedAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number;
  pUnder25: number;
  pBttsYes: number;
  pBttsNo: number;
  appliedRho: number;
}

export interface EloResult {
  homeElo: number;
  awayElo: number;
  eloDiff: number;
  pHome: number;
  pDraw: number;
  pAway: number;
}

export interface FormModelResult {
  homeFormScore: number;
  awayFormScore: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number;
  pBttsYes: number;
}

export interface HomeAwayModelResult {
  homeAdvantageFactor: number;
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  pHome: number;
  pDraw: number;
  pAway: number;
}

export interface LeagueModelResult {
  leagueName: string;
  avgGoals: number;
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
  over25Rate: number;
  bttsRate: number;
}

export interface XGModelResult {
  available: boolean;
  xgHome?: number;
  xgAway?: number;
  xgDiff?: number;
  pHome?: number;
  pDraw?: number;
  pAway?: number;
}

export interface OddsModelResult {
  available: boolean;
  bookmakerMargin: number;
  impliedHome: number;
  impliedDraw: number;
  impliedAway: number;
  valueEdgeHome?: number;
  valueEdgeAway?: number;
}

// Model Agreement & Dispersion
export interface ModelAgreement {
  market: string;
  mean: number;
  median: number;
  variance: number;
  stdDev: number;
  range: number;
  divergenceScore: number; // 0 - 1 (lower is better agreement)
  isAgreementHigh: boolean;
  individualModelProbs: Record<string, number>;
}

// Uncertainty
export interface UncertaintyMetrics {
  modelUncertainty: number; // 0 - 1 (based on dispersion)
  dataUncertainty: number; // 0 - 1 (based on data quality & missing inputs)
  combinedUncertainty: number; // 0 - 1
}

// Anomaly detection
export interface AnomalyItem {
  type: 'PROBABILITY_SUM' | 'SOURCE_CONFLICT' | 'SUDDEN_OUTLIER' | 'IMPOSSIBLE_METRIC' | 'STALE_OVERDUE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKING';
  message: string;
}

export interface AnomalyDetection {
  hasAnomalies: boolean;
  blockingAnomaliesCount: number;
  items: AnomalyItem[];
}

// Calibration report
export interface CalibrationReport {
  market: string;
  brierScore: number;
  logLoss: number;
  calibrationError: number;
  sampleSufficiency: boolean;
  status: 'CALIBRATED' | 'ACCEPTABLE' | 'UNRELIABLE';
}

// Signal States
export type SignalState =
  | 'VERY_STRONG'
  | 'STRONG'
  | 'MEDIUM'
  | 'WEAK'
  | 'WATCH'
  | 'ABSTAIN'
  | 'NO_SIGNAL'
  | 'INSUFFICIENT_DATA'
  | 'MODELS_DISAGREE';

export interface MarketSignal {
  market: string; // e.g. "MS1", "X", "MS2", "OVER_25", "UNDER_25", "BTTS_YES", "BTTS_NO"
  marketNameTr: string; // e.g. "Ev Sahibi Galibiyeti", "2.5 Üst"
  selection: string;
  modelProbability: number; // 0 - 1
  confidence: number; // 0 - 100
  dataQuality: number; // 0 - 100
  agreementScore: number; // 0 - 100
  dispersion: number; // stdDev
  calibrationStatus: string;
  signalState: SignalState;
  passedRiskFilter: boolean;
  riskFilterFailures: string[];
  reasons: string[];
  warnings: string[];
}

export interface AIExplanation {
  summary: string;
  tacticalContext: string;
  modelAgreementAnalysis: string;
  riskAssessment: string;
  factorsFor: string[];
  factorsAgainst: string[];
  generatedAt: string;
  disclaimer: string;
  aiModel?: string;
  aiPromptVersion?: string;
  aiSchemaVersion?: string;
  factCheckPassed?: boolean;
  fallbackUsed?: boolean;
}

export interface MatchAnalysis {
  match: CanonicalMatch;
  h2h?: CanonicalH2H;
  dataQuality: DataQualityReport;
  provenance: DataProvenance;
  models: {
    poisson?: PoissonResult;
    dixonColes?: DixonColesResult;
    elo?: EloResult;
    form?: FormModelResult;
    homeAway?: HomeAwayModelResult;
    league?: LeagueModelResult;
    xg?: XGModelResult;
    odds?: OddsModelResult;
  };
  ensemble: Record<string, number>;
  agreement: Record<string, ModelAgreement>;
  uncertainty: UncertaintyMetrics;
  anomalies: AnomalyDetection;
  calibration: Record<string, CalibrationReport>;
  signals: MarketSignal[];
  primarySignal: MarketSignal | null;
  aiExplanation?: AIExplanation;
  versions: {
    analysisVersion: string;
    modelVersion: string;
    dataVersion: string;
    configVersion: string;
    calibrationVersion: string;
  };
  createdAt: string;
}

// Prediction Ledger Record (Immutable)
export interface PredictionRecord {
  predictionId: string;
  matchId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  market: string;
  selection: string;
  modelProbability: number;
  confidence: number;
  dataQuality: number;
  agreementScore: number;
  dispersion: number;
  signalState: SignalState;
  modelOutputs: Record<string, number>;
  calibrationMetrics: {
    brier: number;
    logLoss: number;
  };
  analysisVersion: string;
  modelVersion: string;
  configVersion: string;
  calibrationVersion: string;
  createdAt: string;
  matchStartTime: string;
  oddsSnapshotId?: string;
  oddsMarketSnapshot?: {
    opening?: number;
    current?: number;
    source?: string;
    overround?: number;
  };
  probabilityEdge?: number;
  lookAheadBiasVerified?: boolean;
  squadSnapshotId?: string;
  marketRegime?: string;
  closingOdds?: number;
  clvPercent?: number;
  recordVersion?: string;
  actualOutcome?: {
    fullTimeScore: { home: number; away: number };
    outcomeWon: boolean;
    brierError: number;
    evaluatedAt: string;
  };
}

// Backtest Data & Results
export interface BacktestResult {
  totalPredictions: number;
  evaluatedPredictions: number;
  wonPredictions: number;
  hitRate: number; // 0 - 100%
  averageBrierScore: number;
  averageLogLoss: number;
  calibrationBins: Array<{
    binRange: string;
    predictedAvg: number;
    actualAvg: number;
    count: number;
  }>;
  driftDetected: boolean;
  driftMessage?: string;
  championVsChallenger: {
    championBrier: number;
    challengerBrier: number;
    pDifference: number;
    recommendation: 'RETAIN_CHAMPION' | 'PROMOTE_CHALLENGER' | 'INSUFFICIENT_EVIDENCE';
  };
}

// Provider Health & Diagnostics
export interface ProviderHealth {
  name: string;
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  isConfigured: boolean;
  latencyMs: number;
  successfulRequests: number;
  errorCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  lastSuccess?: string;
  lastFailure?: string;
  cooldownUntil?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  requestId: string;
  meta?: {
    cached: boolean;
    retrievedAt: string;
    latencyMs: number;
    provider: string;
  };
}

export * from './odds';
export * from './advanced';
