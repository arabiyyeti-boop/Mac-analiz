// src/entity/types.ts - Production Canonical Entity & Integrity Contracts (Sections 8-15, 231-250)

export interface CanonicalTeamRecord {
  canonicalTeamId: string;
  sourceTeamIds: Array<{ provider: string; sourceId: string }>;
  officialName: string;
  normalizedName: string;
  shortName: string;
  country: string;
  competitionIds: string[];
  aliases: string[];
  logoUrl: string;
  logoSource: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  identityConfidence: number; // 0.0 - 1.0
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalFixtureRecord {
  canonicalFixtureId: string;
  sourceFixtureIds: Array<{ provider: string; sourceId: string }>;
  homeTeamCanonicalId: string;
  awayTeamCanonicalId: string;
  competitionId: string;
  seasonId: string;
  scheduledAt: string; // ISO UTC
  timezone: string;
  status: string;
  fingerprint: string;
  isRescheduled: boolean;
  rescheduledFrom?: string;
  postponedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalLogoRecord {
  canonicalTeamId: string;
  ownerTeamName: string;
  logoUrl: string;
  logoSource: string;
  version: string;
  retrievedAt: string;
  isVerified: boolean;
  checksum?: string;
}

export interface LogoVerificationResult {
  isVerified: boolean;
  canonicalTeamId: string;
  effectiveLogoUrl?: string;
  fallbackInitials: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  conflictDetected: boolean;
  conflictReason?: string;
}

export interface OddsBindingVerification {
  isValid: boolean;
  canonicalFixtureId: string;
  oddsEventId?: string;
  homeTeamCanonicalId: string;
  awayTeamCanonicalId: string;
  kickoffDifferenceMinutes: number;
  isStale: boolean;
  stalenessAgeMinutes: number;
  reasonCode?: 'VALID' | 'ODDS_FIXTURE_MISMATCH' | 'ODDS_STALE' | 'ODDS_TEAM_MISMATCH' | 'ODDS_NOT_FOUND' | 'ODDS_INVALID';
  diagnosticMessage: string;
}

export interface H2HBindingVerification {
  isValid: boolean;
  canonicalFixtureId: string;
  homeTeamCanonicalId: string;
  awayTeamCanonicalId: string;
  rejectedMatchesCount: number;
  validMatchesCount: number;
  diagnosticMessage: string;
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

export interface SquadBindingVerification {
  isValid: boolean;
  canonicalFixtureId: string;
  homeTeamCanonicalId: string;
  awayTeamCanonicalId: string;
  homeSquadValid: boolean;
  awaySquadValid: boolean;
  ambiguousPlayersCount: number;
  rejectedPlayersCount: number;
  isStale: boolean;
  stalenessAgeMinutes: number;
  reasonCode:
    | 'VALID'
    | 'SQUAD_NOT_FOUND'
    | 'SQUAD_TEAM_MISMATCH'
    | 'SQUAD_FIXTURE_MISMATCH'
    | 'SQUAD_STALE'
    | 'AMBIGUOUS_PLAYER_IDENTITY'
    | 'FUTURE_DATA_LEAKAGE';
  diagnosticMessage: string;
}

export interface FinalConsistencyReport {
  isConsistent: boolean;
  fixtureIdentityValid: boolean;
  homeTeamValid: boolean;
  awayTeamValid: boolean;
  competitionValid: boolean;
  kickoffValid: boolean;
  homeLogoValid: boolean;
  awayLogoValid: boolean;
  oddsBindingValid: boolean;
  statsBindingValid: boolean;
  h2hBindingValid: boolean;
  xgBindingValid?: boolean;
  squadBindingValid?: boolean;
  sourceAgreementValid: boolean;
  freshnessValid: boolean;
  blockingReasons: string[];
  warnings: string[];
  canonicalFixtureId: string;
  analysisPermitted: boolean;
}
