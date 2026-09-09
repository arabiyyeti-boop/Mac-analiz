// src/api/providers/FootballDataOrgProvider.ts - Adapter for football-data.org API
import { FootballDataProvider, ProviderFixtureQuery, ProviderResult } from './FootballDataProvider';
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, MatchStatus } from '@/types';

export class FootballDataOrgProvider implements FootballDataProvider {
  readonly name = 'football-data.org';
  private apiKey: string;
  private baseUrl = 'https://api.football-data.org/v4';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FOOTBALL_DATA_ORG_KEY || process.env.FOOTBALL_API_KEY || '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  private async fetchWithAuth<T>(endpoint: string): Promise<{ data: T; latencyMs: number }> {
    if (!this.isConfigured()) {
      throw new Error(`PROVIDER_NOT_CONFIGURED: ${this.name} requires a valid API key in environment variables.`);
    }

    const start = Date.now();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': this.apiKey,
        'Accept': 'application/json',
      },
    });

    const latencyMs = Date.now() - start;

    if (response.status === 429) {
      throw new Error(`PROVIDER_RATE_LIMIT: ${this.name} rate limit reached (status 429).`);
    }

    if (!response.ok) {
      throw new Error(`PROVIDER_HTTP_ERROR: ${this.name} responded with status ${response.status}: ${response.statusText}`);
    }

    const json = await response.json() as T;
    return { data: json, latencyMs };
  }

  async getFixtures(query?: ProviderFixtureQuery): Promise<ProviderResult<CanonicalMatch[]>> {
    const today = new Date().toISOString().split('T')[0];
    const dateFrom = query?.dateFrom || today;
    const dateTo = query?.dateTo || today;

    const endpoint = `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const { data: raw, latencyMs } = await this.fetchWithAuth<{ matches: any[] }>(endpoint);

    const matches: CanonicalMatch[] = (raw.matches || []).map((m: any) => this.mapMatch(m));

    return {
      data: matches,
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: raw.matches?.length || 0,
      },
    };
  }

  async getMatchDetails(matchId: string): Promise<ProviderResult<{
    match: CanonicalMatch;
    homeForm?: CanonicalForm;
    awayForm?: CanonicalForm;
    h2h?: CanonicalH2H;
    standing?: { home?: CanonicalStanding; away?: CanonicalStanding };
    stats?: CanonicalStats;
  }>> {
    const { data: rawMatch, latencyMs } = await this.fetchWithAuth<any>(`/matches/${matchId}`);
    const match = this.mapMatch(rawMatch);

    let h2h: CanonicalH2H | undefined;
    try {
      const { data: rawH2h } = await this.fetchWithAuth<any>(`/matches/${matchId}/head2head?limit=10`);
      if (rawH2h && rawH2h.aggregates) {
        const matchesCount = rawH2h.aggregates.numberOfMatches || 0;
        h2h = {
          status: matchesCount > 0 ? 'AVAILABLE' : 'MISSING',
          matchesCount,
          homeWins: rawH2h.aggregates.homeTeam?.wins || 0,
          draws: rawH2h.aggregates.homeTeam?.draws || 0,
          awayWins: rawH2h.aggregates.awayTeam?.wins || 0,
          totalGoals: rawH2h.aggregates.totalGoals || 0,
          avgGoals: matchesCount ? Number((rawH2h.aggregates.totalGoals / matchesCount).toFixed(2)) : 0,
          recentMatches: (rawH2h.matches || []).map((m: any) => ({
            date: m.utcDate,
            homeTeam: m.homeTeam?.name || '',
            awayTeam: m.awayTeam?.name || '',
            homeScore: m.score?.fullTime?.home ?? 0,
            awayScore: m.score?.fullTime?.away ?? 0,
          })),
          source: this.name,
          retrievedAt: new Date().toISOString(),
          confidence: matchesCount > 0 ? 1.0 : 0,
        };
      }
    } catch {
      // H2H may not be available on all plans, gracefully skip
    }

    return {
      data: {
        match,
        h2h,
      },
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: 1,
      },
    };
  }

  async getStandings(competitionCode: string): Promise<ProviderResult<CanonicalStanding[]>> {
    const { data: raw, latencyMs } = await this.fetchWithAuth<any>(`/competitions/${competitionCode}/standings`);
    const table = raw?.standings?.[0]?.table || [];

    const standings: CanonicalStanding[] = table.map((entry: any) => ({
      position: entry.position,
      team: {
        id: entry.team.id,
        name: entry.team.name,
        shortName: entry.team.shortName || entry.team.name,
        tla: entry.team.tla,
        crest: entry.team.crest,
      },
      playedGames: entry.playedGames,
      won: entry.won,
      draw: entry.draw,
      lost: entry.lost,
      points: entry.points,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      goalDifference: entry.goalDifference,
      form: entry.form,
    }));

    return {
      data: standings,
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: standings.length,
      },
    };
  }

  async getH2H(homeTeamId: string | number, awayTeamId: string | number): Promise<ProviderResult<CanonicalH2H>> {
    // football-data.org provides H2H via matchId, but if team IDs are given, fallback to missing structure
    return {
      data: {
        status: 'MISSING',
        matchesCount: 0,
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        totalGoals: 0,
        avgGoals: 0,
        recentMatches: [],
        source: this.name,
        retrievedAt: new Date().toISOString(),
        confidence: 0,
      },
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs: 0,
        rawCount: 0,
      },
    };
  }

  private mapMatch(raw: any): CanonicalMatch {
    const statusMap: Record<string, MatchStatus> = {
      SCHEDULED: 'SCHEDULED',
      TIMED: 'TIMED',
      IN_PLAY: 'IN_PLAY',
      PAUSED: 'PAUSED',
      FINISHED: 'FINISHED',
      POSTPONED: 'POSTPONED',
      CANCELLED: 'CANCELLED',
      SUSPENDED: 'SUSPENDED',
    };

    return {
      id: String(raw.id),
      externalId: String(raw.id),
      provider: this.name,
      utcDate: raw.utcDate,
      status: statusMap[raw.status] || 'SCHEDULED',
      minute: raw.minute,
      homeTeam: {
        id: raw.homeTeam?.id || 0,
        name: raw.homeTeam?.name || 'Home Team',
        shortName: raw.homeTeam?.shortName || raw.homeTeam?.name || 'Home',
        tla: raw.homeTeam?.tla,
        crest: raw.homeTeam?.crest,
      },
      awayTeam: {
        id: raw.awayTeam?.id || 0,
        name: raw.awayTeam?.name || 'Away Team',
        shortName: raw.awayTeam?.shortName || raw.awayTeam?.name || 'Away',
        tla: raw.awayTeam?.tla,
        crest: raw.awayTeam?.crest,
      },
      league: {
        id: raw.competition?.id || 0,
        name: raw.competition?.name || 'Unknown Competition',
        code: raw.competition?.code || 'GEN',
        country: raw.area?.name || '',
        emblem: raw.competition?.emblem,
      },
      venue: raw.venue,
      matchday: raw.matchday,
      score: raw.score ? {
        fullTime: {
          home: raw.score.fullTime?.home ?? null,
          away: raw.score.fullTime?.away ?? null,
        },
        halfTime: {
          home: raw.score.halfTime?.home ?? null,
          away: raw.score.halfTime?.away ?? null,
        },
      } : undefined,
    };
  }
}
