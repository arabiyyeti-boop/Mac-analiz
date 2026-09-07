// src/api/providers/FootballDataProvider.ts - Abstraction Interface for Real Football Providers
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, CanonicalOdds } from '@/types';

export interface ProviderFixtureQuery {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  status?: string;
  competitions?: string[];
}

export interface ProviderResult<T> {
  data: T;
  provenance: {
    provider: string;
    retrievedAt: string;
    latencyMs: number;
    rawCount: number;
  };
}

export interface FootballDataProvider {
  readonly name: string;
  isConfigured(): boolean;
  getFixtures(query?: ProviderFixtureQuery): Promise<ProviderResult<CanonicalMatch[]>>;
  getMatchDetails(matchId: string): Promise<ProviderResult<{
    match: CanonicalMatch;
    homeForm?: CanonicalForm;
    awayForm?: CanonicalForm;
    h2h?: CanonicalH2H;
    standing?: { home?: CanonicalStanding; away?: CanonicalStanding };
    stats?: CanonicalStats;
    odds?: CanonicalOdds;
  }>>;
  getStandings(competitionCode: string): Promise<ProviderResult<CanonicalStanding[]>>;
  getH2H(homeTeamId: string | number, awayTeamId: string | number): Promise<ProviderResult<CanonicalH2H>>;
}
