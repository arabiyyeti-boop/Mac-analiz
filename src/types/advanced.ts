// src/types/advanced.ts - Advanced Intelligence, Market Regime, Squad & Quality Models
import { CanonicalMatch, MatchAnalysis, MarketSignal, CanonicalTeam } from '@/types';

// 148. Market Regime
export type MarketRegimeType =
  | 'NORMAL'
  | 'LOW_LIQUIDITY'
  | 'HIGH_VOLATILITY'
  | 'FAST_ODDS_MOVEMENT'
  | 'NEAR_KICKOFF'
  | 'POST_LINEUP'
  | 'ABNORMAL_MOVEMENT'
  | 'DATA_CONFLICT';

export interface MarketRegime {
  regime: MarketRegimeType;
  description: string;
  detectedAt: string;
  volatilityIndex: number; // 0 - 100
  liquidityScore: number; // 0 - 100
  timeToKickoffMinutes: number;
  timeWindow: 'EARLY' | 'MID' | 'PRE_KICKOFF';
  isAbnormal: boolean;
  warnings: string[];
}

// 149 & 150. Lineup Impact & Squad Strength Snapshot
export interface PlayerStatus {
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  isKeyPlayer: boolean;
  isStarter: boolean;
  seasonMinutesRatio?: number;
  injuryReason?: string;
}

export interface SquadStrengthSnapshot {
  snapshotId: string;
  matchId: string;
  capturedAt: string;
  lineupStatus: 'CONFIRMED' | 'EXPECTED' | 'UNAVAILABLE';
  lineupConfidence: number; // 0 - 100
  homeStrength: {
    availablePlayersCount: number;
    missingKeyPlayers: PlayerStatus[];
    goalkeeperStatus: 'STARTING' | 'BACKUP' | 'UNKNOWN';
    defenderAbsenceSeverity: 'NONE' | 'LOW' | 'HIGH';
    attackerAbsenceSeverity: 'NONE' | 'LOW' | 'HIGH';
    lineupImpactScore: number; // -100 to +100
    impactStatus: 'VERIFIED' | 'UNKNOWN_IMPACT';
  };
  awayStrength: {
    availablePlayersCount: number;
    missingKeyPlayers: PlayerStatus[];
    goalkeeperStatus: 'STARTING' | 'BACKUP' | 'UNKNOWN';
    defenderAbsenceSeverity: 'NONE' | 'LOW' | 'HIGH';
    attackerAbsenceSeverity: 'NONE' | 'LOW' | 'HIGH';
    lineupImpactScore: number;
    impactStatus: 'VERIFIED' | 'UNKNOWN_IMPACT';
  };
  discrepancyWithExpected: boolean;
}

// 151. Injury Severity
export interface InjurySeverityReport {
  teamName: string;
  totalInjured: number;
  starterCount: number;
  keyPlayerCount: number;
  severityIndex: number; // 0 - 100
  impactClassification: 'NEGLIGIBLE' | 'MODERATE' | 'CRITICAL' | 'UNKNOWN_IMPACT';
  details: string[];
}

// 152 & 153. Schedule Fatigue & Rest Advantage
export interface ScheduleFatigueReport {
  homeRestDays: number;
  awayRestDays: number;
  restDifference: number; // homeRestDays - awayRestDays
  homeMatchesIn14Days: number;
  awayMatchesIn14Days: number;
  homeCongestionLevel: 'FRESH' | 'MODERATE' | 'FATIGUED' | 'SEVERE';
  awayCongestionLevel: 'FRESH' | 'MODERATE' | 'FATIGUED' | 'SEVERE';
  restAdvantageTeam: 'HOME' | 'AWAY' | 'NEUTRAL';
  notes: string[];
}

// 154. Match Importance
export interface MatchImportanceContext {
  importanceLevel: 'HIGH' | 'MEDIUM' | 'STANDARD';
  type: 'TITLE_RACE' | 'EUROPEAN_RACE' | 'RELEGATION_BATTLE' | 'PLAYOFF' | 'DERBY' | 'REGULAR';
  description: string;
  isVerifiable: boolean;
}

// 155. Optional Weather Context
export interface WeatherPitchContext {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  temperatureC?: number;
  condition?: string;
  rainProbability?: number;
  pitchQuality?: 'EXCELLENT' | 'GOOD' | 'WET' | 'HEAVY' | 'UNKNOWN';
  source?: string;
}

// 156 & 157. Market Closing Line & CLV
export interface ClosingLineRecord {
  predictionOdds: number;
  closingOdds: number;
  oddsDelta: number;
  movementPercent: number;
  clvPercent: number; // ((predictionOdds / closingOdds) - 1) * 100
  clvStatus: 'POSITIVE_CLV' | 'NEUTRAL' | 'NEGATIVE_CLV';
  recordedAt: string;
  closingRecordedAt: string;
}

// 158, 159, 160. Market Consensus, Outliers & Suspension
export interface MarketConsensusReport {
  market: string;
  consensusOdds: { home: number; draw: number; away: number };
  providerCount: number;
  dispersion: number;
  isSuspended: boolean;
  outliers: Array<{
    provider: string;
    selection: string;
    odd: number;
    consensusOdd: number;
    deviationPercent: number;
    reason: string;
  }>;
}

// 161. Data Quality Vector (9 sub-metrics)
export interface DataQualityVector {
  overallScore: number; // 0 - 100
  fixtureQuality: number;
  teamQuality: number;
  formQuality: number;
  xGQuality: number;
  injuryQuality: number;
  oddsQuality: number;
  lineupQuality: number;
  freshnessQuality: number;
  sourceAgreement: number;
}

// 162 & 163. Confidence Decomposition & Confidence Ceiling
export interface ConfidenceDecomposition {
  finalConfidence: number; // 0 - 100
  confidenceCeilingApplied: boolean;
  maxAllowedCeiling: number;
  factors: {
    probabilityStrength: number; // 0 - 25
    modelAgreement: number; // 0 - 20
    dataQualityContribution: number; // 0 - 20
    calibrationAlignment: number; // 0 - 15
    sampleSufficiency: number; // 0 - 10
    freshnessScore: number; // 0 - 10
  };
  penalties: {
    marketInconsistencyPenalty: number;
    uncertaintyPenalty: number;
    anomalyPenalty: number;
    regimePenalty: number;
  };
  explanation: string;
}

// 164. Model Disagreement Matrix
export interface PairwiseDisagreement {
  modelA: string;
  modelB: string;
  difference: number; // probability delta
  alignmentStatus: 'ALIGNED' | 'MILD_DISAGREEMENT' | 'STRONG_DIVERGENCE';
}

// 165. Feature Contribution
export interface FeatureContributionItem {
  featureName: string;
  impactDirection: 'POSITIVE' | 'NEGATIVE';
  weight: number; // e.g. +0.08 or -0.05
  description: string;
  isVerifiable: boolean;
}

// 166 & 167. Counterfactual & Sensitivity Analysis
export interface CounterfactualScenario {
  scenarioName: string;
  description: string;
  originalProbability: number;
  counterfactualProbability: number;
  delta: number;
}

export interface SensitivityAnalysisReport {
  sensitivityLevel: 'LOW_SENSITIVITY' | 'MEDIUM_SENSITIVITY' | 'HIGH_SENSITIVITY';
  sensitivityScore: number; // 0 - 100
  scenarios: CounterfactualScenario[];
  criticalFeature: string;
}

// 168 & 169. Robustness & Stability
export interface RobustnessReport {
  status: 'ROBUST' | 'MODERATE' | 'MODEL_FRAGILITY';
  divergenceScore: number; // 0 - 100
  configVariations: Array<{
    configName: string;
    resultState: 'SIGNAL' | 'WATCH' | 'ABSTAIN';
    probability: number;
  }>;
  fragilityWarning?: string;
}

export interface ModelStabilityReport {
  isStable: boolean;
  status: 'STABLE' | 'DRIFTING' | 'MODEL_INSTABILITY';
  previousProbability?: number;
  currentProbability: number;
  shiftDelta: number;
  underlyingDataChanged: boolean;
  warning?: string;
}

// 170 & 171. Reproducibility
export interface ReproducibilitySnapshot {
  snapshotId: string;
  matchId: string;
  dataHash: string;
  modelVersions: {
    analysisVersion: string;
    modelVersion: string;
    configVersion: string;
    calibrationVersion: string;
  };
  storedProbability: number;
  isDeterministic: boolean;
}

// 172, 173, 174. AI Fact Check & Versioning
export interface AIFactCheckResult {
  passed: boolean;
  schemaVersion: string;
  promptVersion: string;
  aiModel: string;
  validatedAt: string;
  discrepancies: string[];
  fallbackUsed: boolean;
}

// 175 & 176. Signal Expiration & Version
export type SignalLifecycleState = 'SIGNAL_VALID' | 'SIGNAL_STALE' | 'SIGNAL_INVALIDATED';

// 180 & 181. Analysis ChangeLog
export interface AnalysisChangeLogEntry {
  timestamp: string;
  trigger: 'ODDS_UPDATE' | 'LINEUP_CONFIRMED' | 'INJURY_UPDATE' | 'XG_REFRESH' | 'MANUAL_RECALC';
  previousProb: number;
  newProb: number;
  delta: number;
  reason: string;
}

// 200 & 201. Quality Scorecard & Self Diagnostics
export interface QualityScorecard {
  generatedAt: string;
  dataQualityHealth: number; // 0 - 100
  providerHealth: number;
  modelHealth: number;
  calibrationHealth: number;
  oddsHealth: number;
  ledgerHealth: number;
  apiHealth: number;
  aiHealth: number;
  testHealth: number;
  overallHealthScore: number;
  systemStatus: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';
  diagnosticMessages: string[];
}

export interface ProviderTrustScore {
  provider: string;
  trustScore: number; // 0 - 100
  schemaReliability: number;
  freshnessReliability: number;
  conflictRate: number;
  quotaStatus: {
    known: boolean;
    remainingQuota: number | 'UNKNOWN';
    limit: number | 'UNKNOWN';
    resetTime: string | 'UNKNOWN';
  };
}
