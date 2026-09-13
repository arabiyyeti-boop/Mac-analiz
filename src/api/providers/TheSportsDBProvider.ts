// src/api/providers/TheSportsDBProvider.ts - Adapter for TheSportsDB API (v1 / json / 3)
import { FootballDataProvider, ProviderFixtureQuery, ProviderResult } from './FootballDataProvider';
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, MatchStatus } from '@/types';

export class TheSportsDBProvider implements FootballDataProvider {
  readonly name = 'TheSportsDB';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = this.cleanKey(apiKey || process.env.THESPORTSDB_KEY || '3');
    this.baseUrl = `https://www.thesportsdb.com/api/v1/json/${this.apiKey}`;
  }

  private cleanKey(key?: string): string {
    if (!key) return '3';
    return key.trim().replace(/^["']|["']$/g, '') || '3';
  }

  isConfigured(): boolean {
    return true; // Free demo key '3' is public and always active
  }

  private async fetchJson<T>(endpoint: string): Promise<{ data: T; latencyMs: number }> {
    const start = Date.now();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      throw new Error(`PROVIDER_HTTP_ERROR: ${this.name} responded with status ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as T;
    return { data: json, latencyMs };
  }

  async getFixtures(query?: ProviderFixtureQuery): Promise<ProviderResult<CanonicalMatch[]>> {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = query?.dateFrom || today;

    // Fetch soccer events for the day
    const { data: raw, latencyMs } = await this.fetchJson<{ events: any[] }>(`/eventsday.php?d=${targetDate}&s=Soccer`);

    const matches: CanonicalMatch[] = (raw?.events || []).map((e: any) => this.mapMatch(e));

    return {
      data: matches,
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: raw?.events?.length || 0,
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
    const cleanId = matchId.startsWith('tsdb_') ? matchId.replace('tsdb_', '') : matchId;
    const { data: rawEvent, latencyMs } = await this.fetchJson<{ events: any[] }>(`/lookupevent.php?id=${cleanId}`);

    const ev = rawEvent?.events?.[0];
    if (!ev) {
      throw new Error(`MATCH_NOT_FOUND: TheSportsDB match ${cleanId} not found`);
    }

    const match = this.mapMatch(ev);

    let homeForm: CanonicalForm | undefined;
    let awayForm: CanonicalForm | undefined;

    if (ev.idHomeTeam) {
      try {
        const { data: homeLast } = await this.fetchJson<{ results: any[] }>(`/eventslast.php?id=${ev.idHomeTeam}`);
        if (homeLast?.results) {
          homeForm = this.mapForm(homeLast.results, ev.idHomeTeam, ev.strHomeTeam);
        }
      } catch {
        // ignore
      }
    }

    if (ev.idAwayTeam) {
      try {
        const { data: awayLast } = await this.fetchJson<{ results: any[] }>(`/eventslast.php?id=${ev.idAwayTeam}`);
        if (awayLast?.results) {
          awayForm = this.mapForm(awayLast.results, ev.idAwayTeam, ev.strAwayTeam);
        }
      } catch {
        // ignore
      }
    }

    return {
      data: {
        match,
        homeForm,
        awayForm,
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
    return {
      data: [],
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs: 0,
        rawCount: 0,
      },
    };
  }

  async getH2H(homeTeamId: string | number, awayTeamId: string | number): Promise<ProviderResult<CanonicalH2H>> {
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
      },
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs: 0,
        rawCount: 0,
      },
    };
  }

  async searchTeams(query: string): Promise<ProviderResult<Array<{ id: number; name: string; country: string; logo?: string }>>> {
    const { data: raw, latencyMs } = await this.fetchJson<{ teams: any[] }>(`/searchteams.php?t=${encodeURIComponent(query)}`);
    const results = (raw?.teams || []).map((t: any) => ({
      id: parseInt(t.idTeam, 10) || 0,
      name: t.strTeam || '',
      country: t.strCountry || '',
      logo: t.strBadge || t.strLogo || '',
    }));

    return {
      data: results,
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: results.length,
      },
    };
  }

  private mapStatus(strStatus?: string): MatchStatus {
    const s = (strStatus || '').toUpperCase();
    if (['FT', 'AET', 'PEN', 'FINISHED'].includes(s)) return 'FINISHED';
    if (['1H', '2H', 'HT', 'LIVE', 'IN_PLAY'].includes(s)) return 'IN_PLAY';
    if (['POSTPONED', 'PST'].includes(s)) return 'POSTPONED';
    if (['CANCELLED', 'CANC'].includes(s)) return 'CANCELLED';
    if (['SUSPENDED', 'SUSP'].includes(s)) return 'SUSPENDED';
    return 'TIMED';
  }

  private mapMatch(ev: any): CanonicalMatch {
    const utcDate = ev.strTimestamp
      ? (ev.strTimestamp.endsWith('Z') ? ev.strTimestamp : `${ev.strTimestamp}Z`)
      : `${ev.dateEvent}T${ev.strTime || '00:00:00'}Z`;

    const homeScore = ev.intHomeScore !== null && ev.intHomeScore !== undefined && ev.intHomeScore !== ''
      ? parseInt(ev.intHomeScore, 10)
      : null;
    const awayScore = ev.intAwayScore !== null && ev.intAwayScore !== undefined && ev.intAwayScore !== ''
      ? parseInt(ev.intAwayScore, 10)
      : null;

    return {
      id: `tsdb_${ev.idEvent}`,
      externalId: String(ev.idEvent),
      provider: this.name,
      utcDate,
      status: this.mapStatus(ev.strStatus),
      homeTeam: {
        id: parseInt(ev.idHomeTeam, 10) || 0,
        name: ev.strHomeTeam || 'Bilinmeyen Takım',
        shortName: ev.strHomeTeam || 'Ev Sahibi',
        crest: ev.strHomeTeamBadge || '',
      },
      awayTeam: {
        id: parseInt(ev.idAwayTeam, 10) || 0,
        name: ev.strAwayTeam || 'Bilinmeyen Takım',
        shortName: ev.strAwayTeam || 'Deplasman',
        crest: ev.strAwayTeamBadge || '',
      },
      league: {
        id: parseInt(ev.idLeague, 10) || 0,
        name: ev.strLeague || 'Diğer Lig',
        code: ev.strLeagueAlternate || ev.strLeague?.substring(0, 4)?.toUpperCase() || 'TSDB',
        country: ev.strCountry || 'Dünya',
        emblem: ev.strLeagueBadge || '',
      },
      matchday: parseInt(ev.intRound, 10) || undefined,
      score: {
        fullTime: {
          home: isNaN(homeScore as number) ? null : homeScore,
          away: isNaN(awayScore as number) ? null : awayScore,
        },
        halfTime: {
          home: null,
          away: null,
        },
      },
      venue: ev.strVenue ? (ev.strCity ? `${ev.strVenue}, ${ev.strCity}` : ev.strVenue) : undefined,
    };
  }

  private mapForm(results: any[], teamId: string, teamName: string): CanonicalForm {
    const matches = results.slice(0, 5).map((r: any) => {
      const isHome = String(r.idHomeTeam) === String(teamId) || r.strHomeTeam === teamName;
      const homeScore = parseInt(r.intHomeScore, 10) || 0;
      const awayScore = parseInt(r.intAwayScore, 10) || 0;

      let result: 'W' | 'D' | 'L' = 'D';
      if (homeScore === awayScore) result = 'D';
      else if (isHome ? homeScore > awayScore : awayScore > homeScore) result = 'W';
      else result = 'L';

      return {
        date: r.dateEvent,
        opponent: isHome ? r.strAwayTeam : r.strHomeTeam,
        isHome,
        scored: isHome ? homeScore : awayScore,
        conceded: isHome ? awayScore : homeScore,
        result,
      };
    });

    const last5 = matches.map((m) => m.result) as ('W' | 'D' | 'L')[];
    const points = matches.reduce((acc, m) => acc + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0), 0);
    const scored = matches.reduce((acc, m) => acc + m.scored, 0);
    const conceded = matches.reduce((acc, m) => acc + m.conceded, 0);
    const cleanSheets = matches.filter((m) => m.conceded === 0).length;
    const bttsCount = matches.filter((m) => m.scored > 0 && m.conceded > 0).length;
    const over25Count = matches.filter((m) => m.scored + m.conceded > 2.5).length;
    const n = matches.length || 1;

    return {
      teamId,
      matchesPlayed: matches.length,
      last5,
      last10: last5,
      pointsPerGame: Number((points / n).toFixed(2)),
      goalsScoredAvg: Number((scored / n).toFixed(2)),
      goalsConcededAvg: Number((conceded / n).toFixed(2)),
      bttsRate: Number((bttsCount / n).toFixed(2)),
      over25Rate: Number((over25Count / n).toFixed(2)),
      cleanSheetRate: Number((cleanSheets / n).toFixed(2)),
      opponentAdjustedRating: 1.0,
    };
  }
}
