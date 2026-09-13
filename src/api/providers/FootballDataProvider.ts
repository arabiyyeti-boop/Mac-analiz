// src/api/providers/FootballDataProvider.ts - Abstraction Interface for Real Football Providers
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, CanonicalOdds, CanonicalMatchSquadData } from '@/types';

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
    squadData?: CanonicalMatchSquadData;
  }>>;
  getStandings(competitionCode: string): Promise<ProviderResult<CanonicalStanding[]>>;
  getH2H(homeTeamId: string | number, awayTeamId: string | number): Promise<ProviderResult<CanonicalH2H>>;
  searchTeams?(query: string): Promise<ProviderResult<Array<{ id: number; name: string; country: string; logo?: string }>>>;
  getLineups?(fixtureId: string | number, targetMatch?: CanonicalMatch): Promise<ProviderResult<CanonicalMatchSquadData | undefined>>;
  findFixtureId?(homeTeamId: number | string, awayTeamId: number | string, date: string): Promise<number | null>;
}
