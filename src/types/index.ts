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
  lineageId?: string;
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
  homeXG?: number;
  awayXG?: number;
  sourceProvider?: string;
  retrievedAt?: string;
  isRealXG?: boolean;
  topScorers?: Array<{ player: string; goals: number }>;
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

export type H2HFailureReason =
  | 'NO_RECORDS'
  | 'TEAM_ID_UNRESOLVED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'BINDING_FAILED'
  | 'CONFLICTING_DATA';

export interface CanonicalH2H {
  status?: H2HStatus;
  failureReason?: H2HFailureReason;
  providerStatus?: string;
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

// Data Quality 2.0 Core Statuses
export type DataQualityStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'MISSING'
  | 'STALE'
  | 'CONFLICTING'
  | 'LOW_CONFIDENCE'
  | 'INVALID'
  | 'NOT_APPLICABLE';

export type TemporalFreshnessClass =
  | 'REALTIME'
  | 'VERY_FRESH'
  | 'FRESH'
  | 'AGING'
  | 'STALE';

export interface ComponentQualityDetail {
  component: string;
  nameTr: string;
  status: DataQualityStatus;
  freshness: TemporalFreshnessClass;
  retrievedAt?: string;
  ageHours?: number;
  sampleSize?: number;
  score: number; // 0 - 100
  source?: string;
  isLeakageGuarded?: boolean;
  issues?: string[];
}

export interface QualityExplanationItem {
  type: 'CHECK' | 'WARN' | 'DANGER';
  text: string;
}

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
  score: number; // 0 - 100 (composite Data Quality Score)
  status: DataQualityStatus;
  freshnessClass: TemporalFreshnessClass;
  factors: {
    sampleSufficiency: number;
    freshnessScore: number;
    h2hCoverage: number;
    leagueBaselineCoverage: number;
    providerReliability: number;
    xgAvailability: number;
    injuryDataAvailability: number;
    identityIntegrity?: number;
    leakageGuard?: number;
  };
  componentDetails: Record<string, ComponentQualityDetail>;
  qualityExplanations: QualityExplanationItem[];
  confidenceCeiling: number; // 0 - 100
  samplePenaltyApplied: boolean;
  shrinkageRecommended: boolean;
  futureLeakageDetected: boolean;
  crossSourceConflicting: boolean;
  warnings: string[];
  blockingReasons?: string[];
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
  oddsHome?: number;
  oddsDraw?: number;
  oddsAway?: number;
  rawImpliedHome?: number;
  rawImpliedDraw?: number;
  rawImpliedAway?: number;
  impliedHome: number;
  impliedDraw: number;
  impliedAway: number;
  valueEdgeHome?: number;
  valueEdgeDraw?: number;
  valueEdgeAway?: number;
  evHome?: number;
  evDraw?: number;
  evAway?: number;
  isPositiveEvHome?: boolean;
  isPositiveEvDraw?: boolean;
  isPositiveEvAway?: boolean;
  hasValueHome?: boolean;
  hasValueDraw?: boolean;
  hasValueAway?: boolean;
  kellyHome?: number;
  kellyDraw?: number;
  kellyAway?: number;
  halfKellyHome?: number;
  halfKellyDraw?: number;
  halfKellyAway?: number;
}

// Dynamic Team Strength Profile
export interface TeamStrengthProfile {
  teamId: string | number;
  canonicalTeamId: string;
  teamName: string;
  overallStrength: number; // 0 - 100 (centered around league baseline ~50)
  attackStrength: number; // 0 - 100
  defenseStrength: number; // 0 - 100 (higher = concedes less)
  homeStrength: number; // 0 - 100
  awayStrength: number; // 0 - 100
  homeAttackStrength: number;
  homeDefenseStrength: number;
  awayAttackStrength: number;
  awayDefenseStrength: number;
  recentStrength: number; // recency-weighted short-term capability
  opponentAdjustedStrength: number; // iterative opponent difficulty adjusted
  strengthUncertainty: number; // 0 - 100 (higher = more uncertain)
  uncertaintyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sampleSize: number; // total games analyzed
  homeSampleSize: number;
  awaySampleSize: number;
  dataQuality: number; // 0 - 100 (from Data Quality 2.0)
  shrinkageFactor: number; // 0 - 1 (weight pulled toward baseline)
  seasonTransitionApplied: boolean;
  homeAdvantageNeutralized: boolean; // guards against double-counting with Poisson
  updatedAt: string;
  methodVersion: string; // e.g. "DTS_v2.0_OPP_ADJUSTED"
  reasons: string[];
}

export interface MatchTeamStrength {
  home: TeamStrengthProfile;
  away: TeamStrengthProfile;
  netStrengthAdvantage: number; // home.overallStrength - away.overallStrength
  netOpponentAdjustedAdvantage: number;
  homeAdvantageNeutralized: boolean;
  combinedUncertainty: number;
  modelDisagreementNote?: string;
}

// Opponent-Adjusted Form (OAF v2.0) Profile
export interface OpponentAdjustedFormProfile {
  teamId: string | number;
  canonicalTeamId: string;
  teamName: string;
  adjustedFormScore: number; // 0 - 100 (primary OAF metric)
  rawFormScore: number; // 0 - 100 (unadjusted baseline from raw W/D/L/GD)
  opponentAdjustedScore: number; // 0 - 100 (difficulty adjusted)
  recentFormScore: number; // 0 - 100 (time-weighted recency score)
  homeFormScore: number; // 0 - 100 (venue isolated with shrinkage)
  awayFormScore: number; // 0 - 100 (venue isolated with shrinkage)
  attackForm: number; // 0 - 100 (recent scoring capability vs opposition)
  defenseForm: number; // 0 - 100 (recent defensive solidity vs opposition)
  weightedPoints: number; // decay-weighted points total
  weightedGoalDifference: number; // dampened & weighted goal difference
  opponentStrengthAverage: number; // 0 - 100 (mean difficulty of opponents faced)
  sampleSize: number; // number of matches evaluated
  formVolatility: number; // 0 - 100 (performance variance across matches)
  uncertainty: number; // 0 - 100
  uncertaintyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataQuality: number; // 0 - 100 (linked to DQ 2.0)
  recencyWeight: number; // alpha decay parameter applied
  shrinkageFactor: number; // 0 - 1 (shrinkage toward baseline 50)
  seasonTransitionApplied: boolean;
  dtsDoubleCountingNeutralized: boolean; // guards against double-counting with DTS
  eloDoubleCountingNeutralized: boolean; // guards against double-counting with Elo
  updatedAt: string;
  methodVersion: string; // "OAF_v2.0_OPP_ADJUSTED"
  reasons: string[];
}

export interface MatchOpponentAdjustedForm {
  home: OpponentAdjustedFormProfile;
  away: OpponentAdjustedFormProfile;
  netFormAdvantage: number; // home.adjustedFormScore - away.adjustedFormScore
  combinedUncertainty: number; // 0 - 100
  isReliable: boolean;
  abstainRecommendation?: boolean;
  contextDisagreementNote?: string;
}

// Advanced xG v2.0 Profile & Verification
export type RealXGStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'MISSING'
  | 'STALE'
  | 'INVALID'
  | 'CONFLICTING';

export interface AdvancedXGProfile {
  teamId: string | number;
  canonicalTeamId: string;
  teamName: string;
  status: RealXGStatus;
  realXGFor?: number;         // Verified match xG or recent per-match average xG
  realXGAgainst?: number;     // Verified match xGA or recent per-match average xGA
  realXGPerMatch?: number;    // Season/sample average xG per match
  realXGAPerMatch?: number;   // Season/sample average xGA per match
  homeXG?: number;            // Home-specific real xG
  awayXG?: number;            // Away-specific real xG
  homeXGA?: number;           // Home-specific real xGA
  awayXGA?: number;           // Away-specific real xGA
  recentXG?: number;          // Last N matches weighted real xG
  recentXGA?: number;         // Last N matches weighted real xGA
  xGOverperformance?: number; // Actual Goals Scored - Real xG (+ = overperforming / clinical, - = underperforming)
  xGUnderperformance?: number;// Actual Goals Conceded - Real xGA (+ = conceded more than expected / leaky)
  sampleSize: number;
  uncertainty: number;        // 0 - 100 (higher = more uncertain)
  dataQuality: number;        // 0 - 100 (from Data Quality 2.0)
  source?: string;            // Provider name (e.g., 'api-football', 'understat')
  retrievedAt?: string;
  methodVersion: string;      // 'ADVANCED_xG_v2.0'
  provenance?: {
    provider?: string;
    sourceFixtureId?: string;
    sourceTeamId?: string;
    retrievedAt?: string;
    canonicalFixtureId?: string;
    canonicalTeamId?: string;
    verified: boolean;
  };
  regressionSignal?: {
    isRegressionCandidate: boolean;
    type: 'NEGATIVE_REGRESSION' | 'POSITIVE_REGRESSION' | 'NEUTRAL';
    note: string;
    confidence: number;
  };
  shrinkageFactor: number;    // 0 - 1 (shrinkage pulled toward baseline if sample is small)
  reasons: string[];
}

export interface MatchAdvancedXG {
  status: RealXGStatus;
  isAvailable: boolean;
  home: AdvancedXGProfile;
  away: AdvancedXGProfile;
  modelExpectedGoals: {
    home: number;               // Theoretical Poisson lambdaHome or model expected goals
    away: number;               // Theoretical Poisson lambdaAway or model expected goals
    sourceModel: string;        // e.g., "Poisson (Bivariate PMF)"
    homeExpectedGoals: number;
    awayExpectedGoals: number;
  };
  provenance?: {
    provider?: string;
    fixtureId?: string;
    verifiedAt?: string;
    bindingValid: boolean;
  };
  dataQuality: number;          // 0 - 100
  uncertainty: number;          // 0 - 100
  sensitivityNote?: string;
  methodVersion: string;        // 'ADVANCED_xG_v2.0'
  reasons: string[];
}

export interface XGBindingVerification {
  isValid: boolean;
  canonicalFixtureId: string;
  homeTeamCanonicalId: string;
  awayTeamCanonicalId: string;
  isStale: boolean;
  stalenessAgeMinutes: number;
  reasonCode:
    | 'VALID'
    | 'XG_NOT_FOUND'
    | 'XG_TEAM_MISMATCH'
    | 'XG_FIXTURE_MISMATCH'
    | 'XG_STALE'
    | 'XG_INVALID'
    | 'FUTURE_DATA_LEAKAGE';
  diagnosticMessage: string;
}

// SQUAD / PLAYER IMPACT v2.0 Core Types
export type CanonicalPlayerPosition = 'GK' | 'DEF' | 'MID' | 'ATT' | 'UNKNOWN';

export type CanonicalPlayerAvailabilityStatus =
  | 'AVAILABLE'
  | 'STARTING_EXPECTED'
  | 'STARTING_CONFIRMED'
  | 'BENCH_EXPECTED'
  | 'INJURED'
  | 'SUSPENDED'
  | 'DOUBTFUL'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export interface CanonicalPlayer {
  canonicalPlayerId: string;
  sourcePlayerId?: string | number;
  provider?: string;
  canonicalTeamId: string;
  name: string;
  number?: number;
  position: CanonicalPlayerPosition;
  role?: string;
  status: CanonicalPlayerAvailabilityStatus;
  isStarter?: boolean;
  isCaptain?: boolean;
  expectedMinutes?: number;
  availabilityProbability?: number; // 0.0 to 1.0
  // Verified performance statistics if provided by reliable source
  seasonMinutes?: number;
  seasonAppearances?: number;
  goals?: number;
  assists?: number;
  cleanSheets?: number;
  realXG?: number; // ONLY verified provider xG, never invented
  realXA?: number;
  injuryReason?: string;
  suspensionReason?: string;
  verified: boolean;
}

export interface CanonicalTeamSquad {
  teamId: string | number;
  canonicalTeamId: string;
  teamName?: string;
  formation?: string;
  coach?: string;
  isConfirmed: boolean; // true = CONFIRMED starting XI, false = EXPECTED lineup
  lineupTimestamp?: string;
  startingXI: CanonicalPlayer[];
  bench: CanonicalPlayer[];
  injuriesAndAbsences: CanonicalPlayer[];
  positionCoverage: {
    goalkeepers: number;
    defenders: number;
    midfielders: number;
    attackers: number;
  };
}

export interface CanonicalMatchSquadData {
  home: CanonicalTeamSquad;
  away: CanonicalTeamSquad;
  provider: string;
  retrievedAt: string;
  isConfirmed: boolean;
}

export interface PlayerImpactItem {
  player: CanonicalPlayer;
  role: CanonicalPlayerPosition;
  availabilityStatus: CanonicalPlayerAvailabilityStatus;
  expectedMinutes: number;
  availabilityProbability: number;
  sampleSize: number;
  shrinkageFactor: number; // 0 - 1 (low sample pulls impact toward 0)
  impactScore: number; // relative impact on team capability (-10 to +10, not raw win prob)
  impactConfidence: number; // 0 - 100
  impactUncertainty: number; // 0 - 100
  isKeyPlayer: boolean;
  replacementCoverage: 'STRONG' | 'ADEQUATE' | 'DEPLETED' | 'UNKNOWN';
  explanation: string;
  dataQuality: DataQualityStatus;
}

export interface TeamSquadImpact {
  canonicalTeamId: string;
  teamName: string;
  lineupStatus: 'CONFIRMED' | 'EXPECTED' | 'UNAVAILABLE';
  availableCount: number;
  doubtfulCount: number;
  missingCount: number;
  keyMissingCount: number;
  goalkeeperStatus: {
    status: 'STARTING_CONFIRMED' | 'STARTING_EXPECTED' | 'BACKUP' | 'MISSING' | 'UNKNOWN';
    impactScore: number;
    confidence: number;
    uncertainty: number;
    details: string;
  };
  defensiveCoverage: {
    rating: 'SOLID' | 'ADEQUATE' | 'DEPLETED' | 'UNKNOWN';
    activeDefendersCount: number;
    impactScore: number;
  };
  attackingCoverage: {
    rating: 'FULL_STRENGTH' | 'ADEQUATE' | 'DEPLETED' | 'UNKNOWN';
    activeAttackersCount: number;
    impactScore: number;
  };
  depthAssessment: 'STRONG' | 'ADEQUATE' | 'LIMITED' | 'UNKNOWN';
  multipleAbsencesInteractionPenalty: number;
  netSquadImpactScore: number; // -50 to +50 relative score
  impactLevel: 'HIGH_POSITIVE' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'CRITICAL_NEGATIVE' | 'UNKNOWN';
  confidence: number; // 0 - 100
  uncertainty: number; // 0 - 100
  dataQuality: DataQualityStatus;
  players: PlayerImpactItem[];
  reasons: string[];
}

export interface MatchSquadImpact {
  squadSnapshotId: string; // Deterministic snapshot ID for reproducible analysis & ledger
  status: DataQualityStatus;
  isAvailable: boolean;
  isConfirmed: boolean;
  lineupType: 'CONFIRMED' | 'EXPECTED' | 'UNAVAILABLE';
  home: TeamSquadImpact;
  away: TeamSquadImpact;
  relativeSquadAdvantage: number; // home.netSquadImpactScore - away.netSquadImpactScore
  doubleCountingGuards: {
    dtsIsolated: boolean; // Confirms DTS baseline was not duplicated
    oafIsolated: boolean; // Confirms OAF recent form was not duplicated
    xgIsolated: boolean;  // Confirms Real xG was not duplicated
    eloProtected: boolean;// Confirms Elo was not altered
    probabilityDirectlyManipulated: boolean; // Strictly false (no hardcoded prob shifts)
  };
  futureLeakageGuard: {
    evaluationTimestamp: string;
    fixtureKickoff: string;
    passed: boolean;
  };
  dataQuality: number; // 0 - 100
  uncertainty: number; // 0 - 100
  methodVersion: string; // 'SQUAD_PLAYER_IMPACT_v2.0'
  abstention: {
    isAbstained: boolean;
    reason?: string;
  };
  summary: string;
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
  odds?: number;
  fairProbability?: number;
  rawImpliedProbability?: number;
  valueEdge?: number;
  ev?: number;
  isPositiveEv?: boolean;
  hasValue?: boolean;
  kellyFraction?: number;
  halfKellyFraction?: number;
  calibratedProbability?: number;
  rawProbability?: number;
  calibrationInfo?: PredictionCalibrationInfo;
  clvRecord?: ClvRecord;
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
  teamStrength?: MatchTeamStrength;
  opponentAdjustedForm?: MatchOpponentAdjustedForm;
  advancedXG?: MatchAdvancedXG;
  squadImpact?: MatchSquadImpact;
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

// Prediction Ledger Settlement Status
export type SettlementStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'POSTPONED' | 'CANCELLED';

export interface PredictionActualOutcome {
  status: SettlementStatus;
  fullTimeScore: { home: number; away: number };
  outcomeWon: boolean;
  brierError: number;
  evaluatedAt: string;
  settledAt?: string;
  settlementVersion?: string;
  provenance?: {
    provider: string;
    sourceFixtureId?: string;
    canonicalFixtureId?: string;
    finalScore?: string;
    matchStatus?: MatchStatus;
    settledAt: string;
  };
}

// Closing Line Value (CLV) Record
export interface ClvRecord {
  predictionId: string;
  canonicalFixtureId?: string;
  market: string;
  selection: string;
  predictionOdds: number;
  closingOdds?: number;
  predictionTimestamp: string;
  closingTimestamp?: string;
  kickoffTimestamp?: string;
  clvOddsRatio?: number;      // predictionOdds / closingOdds
  clvPercent?: number;        // ((predictionOdds / closingOdds) - 1) * 100
  predictionFairProb?: number;
  closingFairProb?: number;
  clvFairProbDelta?: number;  // closingFairProb - predictionFairProb
  evClosing?: number;
  isPositiveClv?: boolean;
  status: 'CALCULATED' | 'MISSING' | 'LIVE_DISQUALIFIED';
  calculationVersion: string;
}

export interface ClvAggregateReport {
  sampleSize: number;
  positiveClvCount: number;
  positiveClvRate: number; // 0 - 100%
  meanClvPercent: number;
  medianClvPercent: number;
  meanProbDelta?: number;
  status: 'SUFFICIENT_DATA' | 'INSUFFICIENT_SAMPLE' | 'NO_DATA';
}

// Calibration Record for Prediction
export interface PredictionCalibrationInfo {
  method: 'ISOTONIC' | 'PLATT' | 'NONE';
  version: string;
  trainingCutoff?: string;
  sampleSize?: number;
  rawProbability: number;
  calibratedProbability: number;
  status: 'CALIBRATED' | 'UNCALIBRATED' | 'LOW_CONFIDENCE' | 'ABSTAIN';
}

// Prediction Ledger Record (Immutable)
export interface PredictionRecord {
  predictionId: string;
  matchId: string;
  canonicalFixtureId?: string;
  sourceFixtureId?: string;
  homeTeamId?: string | number;
  awayTeamId?: string | number;
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
  calibratedProbability?: number;
  calibrationInfo?: PredictionCalibrationInfo;
  evSnapshot?: number;
  kellySnapshot?: number;
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
  clvRecord?: ClvRecord;
  recordVersion?: string;
  settlementStatus?: SettlementStatus;
  actualOutcome?: PredictionActualOutcome;
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
  clvReport?: ClvAggregateReport;
  calibrationReport?: {
    selectedMethod: string;
    sampleSize: number;
    calibratedBrier: number;
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
