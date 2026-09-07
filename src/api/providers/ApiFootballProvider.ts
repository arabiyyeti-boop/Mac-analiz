// src/api/providers/ApiFootballProvider.ts - Adapter for API-Football (v3)
import { FootballDataProvider, ProviderFixtureQuery, ProviderResult } from './FootballDataProvider';
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, CanonicalOdds, MatchStatus } from '@/types';

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = 'api-football';
  private apiKey: string;
  private baseUrl = 'https://v3.football.api-sports.io';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.API_FOOTBALL_KEY || '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  private async fetchWithAuth<T>(endpoint: string): Promise<{ data: T; latencyMs: number }> {
    if (!this.isConfigured()) {
      throw new Error(`PROVIDER_NOT_CONFIGURED: ${this.name} requires a valid API key.`);
    }

    const start = Date.now();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'x-apisports-key': this.apiKey,
      },
    });

    const latencyMs = Date.now() - start;

    if (response.status === 429) {
      throw new Error(`PROVIDER_RATE_LIMIT: ${this.name} rate limit reached.`);
    }

    if (!response.ok) {
      throw new Error(`PROVIDER_HTTP_ERROR: ${this.name} responded with status ${response.status}`);
    }

    const json = await response.json() as { response: T; errors: any };
    if (json.errors && Object.keys(json.errors).length > 0) {
      const errStr = JSON.stringify(json.errors);
      if (errStr.includes('rateLimit') || errStr.includes('Requests')) {
        throw new Error(`PROVIDER_RATE_LIMIT: ${errStr}`);
      }
    }

    return { data: json.response, latencyMs };
  }

  async getFixtures(query?: ProviderFixtureQuery): Promise<ProviderResult<CanonicalMatch[]>> {
    const today = new Date().toISOString().split('T')[0];
    const date = query?.dateFrom || today;

    const endpoint = `/fixtures?date=${date}`;
    const { data: rawList, latencyMs } = await this.fetchWithAuth<any[]>(endpoint);

    const matches: CanonicalMatch[] = (rawList || []).map((item: any) => this.mapMatch(item));

    return {
      data: matches,
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: matches.length,
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
    odds?: CanonicalOdds;
  }>> {
    const { data: rawList, latencyMs } = await this.fetchWithAuth<any[]>(`/fixtures?id=${matchId}`);
    if (!rawList || rawList.length === 0) {
      throw new Error(`Match with ID ${matchId} not found on ${this.name}`);
    }

    const raw = rawList[0];
    const match = this.mapMatch(raw);

    // Fetch H2H if available
    let h2h: CanonicalH2H | undefined;
    try {
      const h2hRes = await this.getH2H(raw.teams.home.id, raw.teams.away.id);
      h2h = h2hRes.data;
    } catch {
      // ignore
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
    // League ID expected
    const { data: rawList, latencyMs } = await this.fetchWithAuth<any[]>(`/standings?league=${competitionCode}&season=${new Date().getFullYear()}`);
    const table = rawList?.[0]?.league?.standings?.[0] || [];

    const standings: CanonicalStanding[] = table.map((entry: any) => ({
      position: entry.rank,
      team: {
        id: entry.team.id,
        name: entry.team.name,
        shortName: entry.team.name,
        crest: entry.team.logo,
      },
      playedGames: entry.all?.played || 0,
      won: entry.all?.win || 0,
      draw: entry.all?.draw || 0,
      lost: entry.all?.lose || 0,
      points: entry.points || 0,
      goalsFor: entry.all?.goals?.for || 0,
      goalsAgainst: entry.all?.goals?.against || 0,
      goalDifference: entry.goalsDiff || 0,
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
    const { data: rawList, latencyMs } = await this.fetchWithAuth<any[]>(`/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`);
    const list = rawList || [];

    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    let totalGoals = 0;

    const recentMatches = list.slice(0, 10).map((f: any) => {
      const hScore = f.goals?.home ?? 0;
      const aScore = f.goals?.away ?? 0;
      totalGoals += (hScore + aScore);

      if (hScore > aScore) homeWins++;
      else if (aScore > hScore) awayWins++;
      else draws++;

      return {
        date: f.fixture.date,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        homeScore: hScore,
        awayScore: aScore,
      };
    });

    return {
      data: {
        matchesCount: list.length,
        homeWins,
        draws,
        awayWins,
        totalGoals,
        avgGoals: list.length > 0 ? Number((totalGoals / list.length).toFixed(2)) : 2.5,
        recentMatches,
      },
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: list.length,
      },
    };
  }

  private mapMatch(raw: any): CanonicalMatch {
    const statusMap: Record<string, MatchStatus> = {
      TBD: 'SCHEDULED',
      NS: 'SCHEDULED',
      '1H': 'IN_PLAY',
      HT: 'PAUSED',
      '2H': 'IN_PLAY',
      ET: 'IN_PLAY',
      BT: 'PAUSED',
      P: 'IN_PLAY',
      SUSP: 'SUSPENDED',
      INT: 'PAUSED',
      FT: 'FINISHED',
      AET: 'FINISHED',
      PEN: 'FINISHED',
      PST: 'POSTPONED',
      CANC: 'CANCELLED',
      ABD: 'CANCELLED',
      AWD: 'FINISHED',
      WO: 'FINISHED',
    };

    const rawStatus = raw.fixture?.status?.short || 'NS';

    return {
      id: String(raw.fixture?.id),
      externalId: String(raw.fixture?.id),
      provider: this.name,
      utcDate: raw.fixture?.date,
      status: statusMap[rawStatus] || 'SCHEDULED',
      minute: raw.fixture?.status?.elapsed,
      homeTeam: {
        id: raw.teams?.home?.id || 0,
        name: raw.teams?.home?.name || 'Home',
        shortName: raw.teams?.home?.name || 'Home',
        crest: raw.teams?.home?.logo,
      },
      awayTeam: {
        id: raw.teams?.away?.id || 0,
        name: raw.teams?.away?.name || 'Away',
        shortName: raw.teams?.away?.name || 'Away',
        crest: raw.teams?.away?.logo,
      },
      league: {
        id: raw.league?.id || 0,
        name: raw.league?.name || 'League',
        code: String(raw.league?.id || 'LEAGUE'),
        country: raw.league?.country || '',
        emblem: raw.league?.logo,
      },
      venue: raw.fixture?.venue?.name,
      matchday: raw.league?.round ? parseInt(raw.league.round.replace(/\D/g, '')) || undefined : undefined,
      score: raw.score ? {
        fullTime: {
          home: raw.score.fulltime?.home ?? null,
          away: raw.score.fulltime?.away ?? null,
        },
        halfTime: {
          home: raw.score.halftime?.home ?? null,
          away: raw.score.halftime?.away ?? null,
        },
      } : undefined,
    };
  }
}
