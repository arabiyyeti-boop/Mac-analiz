// src/types/odds.ts - Nesine & Canonical Odds Models, Snapshots, Movements & Provenance

export type NesineAvailability = 'CONNECTED' | 'NESINE_UNAVAILABLE' | 'RATE_LIMITED' | 'PARSING_ERROR' | 'UNCONFIGURED';

export type OddsFreshnessStatus = 'FRESH' | 'RECENT' | 'STALE' | 'UNAVAILABLE';

/**
 * Item 116: Canonical Odds Model
 */
export interface CanonicalOddsItem {
  matchId: string;
  provider: string;
  marketId: string;
  marketName: string;
  selectionId: string;
  selectionName: string;
  odds: number;
  impliedProbability?: number;
  normalizedProbability?: number;
  overround?: number;
  capturedAt: string;
  updatedAt?: string;
  sourceStatus: 'valid' | 'stale' | 'invalid';
}

/**
 * Item 125: Odds Source Provenance
 */
export interface OddsSourceProvenance {
  provider: string;
  source: string;
  retrievedAt: string;
  updatedAt?: string;
  capturedAt: string;
  validationStatus: 'VALID' | 'SEMANTIC_FAIL' | 'SOURCE_CONFLICT' | 'STALE' | 'INVALID';
  freshness: OddsFreshnessStatus;
  rawCount?: number;
  latencyMs?: number;
}

/**
 * Item 113: Odds Provider Query and Result Structures
 */
export interface OddsMatchQuery {
  date?: string;
  leagueId?: string;
  status?: string;
}

export interface OddsMatch {
  matchId: string;
  sourceMatchId: string;
  provider: string;
  country?: string;
  league: string;
  leagueId?: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  isLive: boolean;
  marketCount: number;
}

export interface OddsMarketSelection {
  selectionId: string;
  selectionName: string;
  odds: number;
  impliedProbability: number;
  normalizedProbability?: number;
}

export interface OddsMarketItem {
  marketId: string;
  marketTypeId: number;
  marketName: string;
  sov?: number;
  outcomes: OddsMarketSelection[];
  overround: number;
  fairProbabilities?: Record<string, number>;
  status: 'active' | 'suspended';
}

/**
 * Item 113: Standard OddsProvider Abstraction Layer
 */
export interface OddsProvider {
  readonly name: string;
  getMatches(params: OddsMatchQuery): Promise<{
    data: OddsMatch[];
    provenance: OddsSourceProvenance;
  }>;
  getMarkets(matchId: string): Promise<{
    data: OddsMarketItem[];
    provenance: OddsSourceProvenance;
  }>;
  getOdds(matchId: string): Promise<{
    data: OddsSnapshot;
    provenance: OddsSourceProvenance;
  }>;
}

/**
 * Item 136: Source Conflict Detection Model
 */
export interface SourceConflict {
  type: 'TEAM_MISMATCH' | 'KICKOFF_DISCREPANCY' | 'LEAGUE_MISMATCH' | 'STATUS_CONFLICT' | 'ODDS_ANOMALY';
  message: string;
  severity: 'WARNING' | 'BLOCKING';
  providerA: string;
  providerB: string;
  field: string;
  valueA: any;
  valueB: any;
}

export interface NesineOutcome {
  id: number;
  name: string; // e.g. "1", "X", "2", "Alt", "Üst", "Var", "Yok", "1X", "12", "X2"
  odd: number;
  oddFormatted: string;
}

export interface NesineMarket {
  marketId: number | string;
  marketTypeId: number;
  marketName: string; // e.g. "Maç Sonucu", "2.5 Gol Alt/Üst", "Karşılıklı Gol Var/Yok", "Çifte Şans", "İlk Yarı Sonucu"
  sov?: number; // Special Odds Value (e.g. 2.5, 1.5)
  outcomes: NesineOutcome[];
  overround: number; // Bookmaker margin % (e.g. 5.4)
  fairProbabilities: Record<string, number>; // De-vigged probabilities (0 - 1)
}

/**
 * Item 119: Odds Snapshot Model
 */
export interface OddsSnapshot {
  snapshotId: string;
  matchId: string;
  timestamp: string; // ISO date
  source: 'Nesine' | 'VerifiedBookmaker' | 'System' | string;
  isLive: boolean;
  canonicalOdds?: CanonicalOddsItem[];
  markets: {
    ms1?: number;
    msX?: number;
    ms2?: number;
    over25?: number;
    under25?: number;
    over15?: number;
    under15?: number;
    over35?: number;
    under35?: number;
    bttsYes?: number;
    bttsNo?: number;
    dc1X?: number;
    dc12?: number;
    dcX2?: number;
    ht1?: number;
    htX?: number;
    ht2?: number;
    tg01?: number;
    tg23?: number;
    tg45?: number;
    tg6Plus?: number;
    [key: string]: number | undefined;
  };
  overround: {
    matchResult?: number;
    overUnder25?: number;
    btts?: number;
    [key: string]: number | undefined;
  };
  fairProbabilities: {
    homeWin?: number;
    draw?: number;
    awayWin?: number;
    over25?: number;
    under25?: number;
    bttsYes?: number;
    bttsNo?: number;
    [key: string]: number | undefined;
  };
}

/**
 * Item 120 & 121: Odds Movement Items
 */
export interface OddsMovementItem {
  marketKey: string;
  marketName: string;
  selection: string;
  openingOdd: number;
  currentOdd: number;
  delta: number; // current - opening
  percentChange: number; // ((current - opening) / opening) * 100
  direction: 'DOWN' | 'UP' | 'STABLE';
  isSignificant: boolean; // |percentChange| >= 5%
  movementVelocity?: number; // delta per hour
  signalContext?: 'STEAMING_IN' | 'DRIFTING_OUT' | 'NEUTRAL'; // Informational feature, NOT a guarantee!
}

export interface OddsHistory {
  matchId: string;
  source: string;
  lastUpdated: string;
  openingOdds?: OddsSnapshot;
  currentOdds?: OddsSnapshot;
  snapshots: OddsSnapshot[];
  movements: OddsMovementItem[];
}

export interface ProbabilityEdgeResult {
  market: string;
  selection: string;
  bookmakerOdd: number;
  rawImpliedProbability: number;
  fairImpliedProbability: number;
  modelProbability: number;
  edge: number; // modelProbability - fairImpliedProbability
  edgePercentage: number; // edge * 100
  ev: number; // (modelProbability * bookmakerOdd) - 1
  isPositiveEv: boolean; // ev > 0
  hasValue: boolean; // isPositiveEv && edge > 0
  kellyFraction?: number;
  halfKellyFraction?: number;
  confidenceScore: number;
  riskNotice: string; // Mandatory risk disclosure
}

export interface NesineMatchOddsData {
  nesineEventCode?: number | string;
  status: NesineAvailability;
  source: 'Nesine' | 'UNAVAILABLE';
  retrievedAt: string;
  markets: NesineMarket[];
  snapshot: OddsSnapshot;
  history?: OddsHistory;
  edges: ProbabilityEdgeResult[];
  diagnosticMessage?: string;
  provenance?: OddsSourceProvenance;
}
