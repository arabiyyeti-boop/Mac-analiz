// src/api/providers/ApiFootballProvider.ts - Adapter for API-Football (v3)
import { FootballDataProvider, ProviderFixtureQuery, ProviderResult } from './FootballDataProvider';
import {
  CanonicalMatch,
  CanonicalForm,
  CanonicalH2H,
  CanonicalStanding,
  CanonicalStats,
  CanonicalOdds,
  CanonicalMatchSquadData,
  CanonicalTeamSquad,
  CanonicalPlayer,
  CanonicalPlayerPosition,
  CanonicalPlayerAvailabilityStatus,
  MatchStatus,
} from '@/types';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';

function mapApiFootballPosition(pos?: string): CanonicalPlayerPosition {
  if (!pos) return 'UNKNOWN';
  const clean = pos.toUpperCase().trim();
  if (clean === 'G' || clean === 'GK' || clean.includes('GOAL')) return 'GK';
  if (clean === 'D' || clean === 'DEF' || clean.includes('DEF')) return 'DEF';
  if (clean === 'M' || clean === 'MID' || clean.includes('MID')) return 'MID';
  if (clean === 'F' || clean === 'ATT' || clean === 'FW' || clean.includes('FOR')) return 'ATT';
  return 'UNKNOWN';
}

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = 'api-football';
  private apiKey: string;
  private baseUrl = 'https://v3.football.api-sports.io';
  private lineupCache = new Map<string, { data?: CanonicalMatchSquadData; timestamp: number; ttlMs: number }>();
  private inFlightLineups = new Map<string, Promise<ProviderResult<CanonicalMatchSquadData | undefined>>>();

  constructor(apiKey?: string) {
    this.apiKey = this.cleanKey(
      apiKey ||
      process.env.API_FOOTBALL_KEY ||
      process.env.APIFOOTBALL_KEY ||
      process.env.API_SPORTS_KEY ||
      process.env.FOOTBALL_API_SPORTS_KEY ||
      ''
    );
  }

  private cleanKey(key?: string): string {
    if (!key) return '';
    return key.trim().replace(/^["']|["']$/g, '');
  }

  public getEffectiveKey(): string {
    const direct = this.cleanKey(this.apiKey);
    if (direct) return direct;
    return this.cleanKey(
      process.env.API_FOOTBALL_KEY ||
      process.env.APIFOOTBALL_KEY ||
      process.env.API_SPORTS_KEY ||
      process.env.FOOTBALL_API_SPORTS_KEY ||
      ''
    );
  }

  isConfigured(): boolean {
    const key = this.getEffectiveKey();
    return Boolean(key && key.length > 5);
  }

  private async fetchWithAuth<T>(endpoint: string): Promise<{ data: T; latencyMs: number }> {
    const key = this.getEffectiveKey();
    if (!key || key.length <= 5) {
      throw new Error(`PROVIDER_NOT_CONFIGURED: ${this.name} requires a valid API key.`);
    }

    const start = Date.now();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'x-apisports-key': key,
      },
    });

    const latencyMs = Date.now() - start;

    if (response.status === 429) {
      throw new Error(`PROVIDER_RATE_LIMIT: ${this.name} rate limit reached.`);
    }

    if (!response.ok) {
      throw new Error(`PROVIDER_HTTP_ERROR: ${this.name} responded with status ${response.status}`);
    }

    const json = await response.json() as { response: T; errors: any; results?: number };
    if (json.errors) {
      const errEntries = Array.isArray(json.errors) ? json.errors : Object.entries(json.errors);
      if (errEntries.length > 0) {
        const errStr = JSON.stringify(json.errors);
        const lower = errStr.toLowerCase();
        if (lower.includes('ratelimit') || lower.includes('requests') || lower.includes('limit')) {
          throw new Error(`PROVIDER_RATE_LIMIT: ${errStr}`);
        }
        if (lower.includes('token') || lower.includes('key')) {
          throw new Error(`PROVIDER_NOT_CONFIGURED: ${errStr}`);
        }
        throw new Error(`PROVIDER_ERROR: ${errStr}`);
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
    squadData?: CanonicalMatchSquadData;
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

    // Fetch real match statistics and xG if available from API-Football
    let stats: CanonicalStats | undefined;
    try {
      const statsRes = await this.fetchWithAuth<any[]>(`/fixtures/statistics?fixture=${matchId}`);
      if (statsRes.data && Array.isArray(statsRes.data) && statsRes.data.length >= 2) {
        const homeStatObj = statsRes.data[0];
        const awayStatObj = statsRes.data[1];

        const extractStat = (teamStats: any[], typeName: string): number | undefined => {
          const item = teamStats?.find((s: any) => (s.type || '').toLowerCase() === typeName.toLowerCase());
          if (!item || item.value === null || item.value === undefined) return undefined;
          const num = parseFloat(String(item.value).replace('%', ''));
          return isNaN(num) ? undefined : num;
        };

        const homeStatsList = homeStatObj?.statistics || [];
        const awayStatsList = awayStatObj?.statistics || [];

        const homeXG = extractStat(homeStatsList, 'expected_goals');
        const awayXG = extractStat(awayStatsList, 'expected_goals');
        const homePossession = extractStat(homeStatsList, 'ball possession');
        const homeShots = extractStat(homeStatsList, 'total shots');
        const homeShotsOnTarget = extractStat(homeStatsList, 'shots on goal');
        const homeCorners = extractStat(homeStatsList, 'corner kicks');
        const homeFouls = extractStat(homeStatsList, 'fouls');
        const homeYellows = extractStat(homeStatsList, 'yellow cards');
        const homeReds = extractStat(homeStatsList, 'red cards');

        stats = {
          possession: homePossession,
          shotsTotal: homeShots,
          shotsOnTarget: homeShotsOnTarget,
          corners: homeCorners,
          fouls: homeFouls,
          yellowCards: homeYellows,
          redCards: homeReds,
          xG: homeXG,
          homeXG,
          awayXG,
          sourceProvider: this.name,
          retrievedAt: new Date().toISOString(),
          isRealXG: homeXG !== undefined && awayXG !== undefined,
        };
      }
    } catch {
      // Upcoming matches often do not yet have statistics
    }

    // Fetch real lineups from API-Football /fixtures/lineups?fixture={id}
    let squadData: CanonicalMatchSquadData | undefined;
    const fixtureId = raw.fixture?.id;
    if (fixtureId) {
      try {
        const lineupRes = await this.getLineups(fixtureId, match);
        squadData = lineupRes.data;
      } catch {
        // Lineup unavailable; squadData remains undefined
      }
    }

    return {
      data: {
        match,
        h2h,
        stats,
        squadData,
      },
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: 1,
      },
    };
  }

  /**
   * Fetches real verified lineups from API-Football endpoint:
   * /fixtures/lineups?fixture={id}
   * Strictly no fake/mock/random players, formations, or ratings.
   */
  async getLineups(
    fixtureId: string | number,
    targetMatch?: CanonicalMatch
  ): Promise<ProviderResult<CanonicalMatchSquadData | undefined>> {
    const rawIdStr = String(fixtureId).trim();
    if (!rawIdStr || isNaN(Number(rawIdStr))) {
      return {
        data: undefined,
        provenance: {
          provider: this.name,
          retrievedAt: new Date().toISOString(),
          latencyMs: 0,
          rawCount: 0,
        },
      };
    }

    const cacheKey = `squad_lineup_api_football_${rawIdStr}`;
    const cached = this.lineupCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return {
        data: cached.data,
        provenance: {
          provider: this.name,
          retrievedAt: new Date(cached.timestamp).toISOString(),
          latencyMs: 0,
          rawCount: cached.data ? 1 : 0,
        },
      };
    }

    if (this.inFlightLineups.has(cacheKey)) {
      return this.inFlightLineups.get(cacheKey)!;
    }

    const fetchPromise = (async (): Promise<ProviderResult<CanonicalMatchSquadData | undefined>> => {
      try {
        const { data: rawLineups, latencyMs } = await this.fetchWithAuth<any[]>(`/fixtures/lineups?fixture=${rawIdStr}`);

        if (!rawLineups || !Array.isArray(rawLineups) || rawLineups.length === 0) {
          // No lineup available yet for this fixture
          this.lineupCache.set(cacheKey, {
            data: undefined,
            timestamp: Date.now(),
            ttlMs: 5 * 60 * 1000, // 5 min TTL when lineup is not yet announced
          });
          return {
            data: undefined,
            provenance: {
              provider: this.name,
              retrievedAt: new Date().toISOString(),
              latencyMs,
              rawCount: 0,
            },
          };
        }

        const cem = CanonicalEntityManager.getInstance();
        const homeCanonicalId = targetMatch ? cem.resolveCanonicalTeamId(targetMatch.homeTeam.name) : '';
        const awayCanonicalId = targetMatch ? cem.resolveCanonicalTeamId(targetMatch.awayTeam.name) : '';

        // Match lineup objects to home and away teams
        let homeRaw: any = null;
        let awayRaw: any = null;

        if (rawLineups.length >= 2) {
          if (targetMatch) {
            for (const item of rawLineups) {
              const itemTeamId = String(item.team?.id || '');
              const itemCanonical = cem.resolveCanonicalTeamId(item.team?.name || itemTeamId);
              if (
                (targetMatch.homeTeam.id && String(targetMatch.homeTeam.id) === itemTeamId) ||
                (homeCanonicalId && itemCanonical === homeCanonicalId)
              ) {
                homeRaw = item;
              } else if (
                (targetMatch.awayTeam.id && String(targetMatch.awayTeam.id) === itemTeamId) ||
                (awayCanonicalId && itemCanonical === awayCanonicalId)
              ) {
                awayRaw = item;
              }
            }
          }

          // Fallback if not matched by strict targetMatch IDs
          if (!homeRaw && !awayRaw) {
            homeRaw = rawLineups[0];
            awayRaw = rawLineups[1];
          }
        } else if (rawLineups.length === 1) {
          return {
            data: undefined,
            provenance: {
              provider: this.name,
              retrievedAt: new Date().toISOString(),
              latencyMs,
              rawCount: 1,
            },
          };
        }

        if (!homeRaw || !awayRaw) {
          return {
            data: undefined,
            provenance: {
              provider: this.name,
              retrievedAt: new Date().toISOString(),
              latencyMs,
              rawCount: 0,
            },
          };
        }

        const homeResolvedTeamId = homeCanonicalId || cem.resolveCanonicalTeamId(homeRaw.team?.name || String(homeRaw.team?.id));
        const awayResolvedTeamId = awayCanonicalId || cem.resolveCanonicalTeamId(awayRaw.team?.name || String(awayRaw.team?.id));

        const parsePlayers = (
          playerList: any[],
          isStarter: boolean,
          expectedTeamCanonicalId: string,
          teamId: string | number,
          isConfirmed: boolean
        ): CanonicalPlayer[] => {
          if (!Array.isArray(playerList)) return [];
          const result: CanonicalPlayer[] = [];

          for (const item of playerList) {
            const p = item?.player;
            if (!p || !p.id || !p.name || typeof p.name !== 'string' || p.name.trim().length < 2) {
              continue;
            }

            const lower = p.name.toLowerCase();
            if (
              lower.includes('player') ||
              lower.includes('oyuncu') ||
              lower.includes('mock') ||
              lower.includes('test') ||
              lower.includes('sample') ||
              lower.includes('placeholder')
            ) {
              continue;
            }

            const pos = mapApiFootballPosition(p.pos);
            const status: CanonicalPlayerAvailabilityStatus = isStarter
              ? (isConfirmed ? 'STARTING_CONFIRMED' : 'STARTING_EXPECTED')
              : 'BENCH_EXPECTED';

            result.push({
              canonicalPlayerId: `apifb_${teamId}_${p.id}`,
              sourcePlayerId: p.id,
              provider: this.name,
              canonicalTeamId: expectedTeamCanonicalId,
              name: p.name.trim(),
              number: typeof p.number === 'number' ? p.number : undefined,
              position: pos,
              role: p.grid ? `${pos} (${p.grid})` : (p.pos || undefined),
              status,
              isStarter,
              isCaptain: undefined,
              expectedMinutes: isStarter ? 80 : 20,
              availabilityProbability: isStarter ? 1.0 : 0.6,
              verified: true,
            });
          }

          return result;
        };

        const hasHomeStartXI = Array.isArray(homeRaw.startXI) && homeRaw.startXI.length >= 7;
        const hasAwayStartXI = Array.isArray(awayRaw.startXI) && awayRaw.startXI.length >= 7;
        const isConfirmed = Boolean(hasHomeStartXI && hasAwayStartXI);

        const homeStartXI = parsePlayers(homeRaw.startXI, true, homeResolvedTeamId, homeRaw.team?.id, isConfirmed);
        const homeBench = parsePlayers(homeRaw.substitutes, false, homeResolvedTeamId, homeRaw.team?.id, isConfirmed);
        const awayStartXI = parsePlayers(awayRaw.startXI, true, awayResolvedTeamId, awayRaw.team?.id, isConfirmed);
        const awayBench = parsePlayers(awayRaw.substitutes, false, awayResolvedTeamId, awayRaw.team?.id, isConfirmed);

        const countPositions = (players: CanonicalPlayer[]) => {
          let goalkeepers = 0;
          let defenders = 0;
          let midfielders = 0;
          let attackers = 0;
          for (const pl of players) {
            if (pl.position === 'GK') goalkeepers++;
            else if (pl.position === 'DEF') defenders++;
            else if (pl.position === 'MID') midfielders++;
            else if (pl.position === 'ATT') attackers++;
          }
          return { goalkeepers, defenders, midfielders, attackers };
        };

        const homeSquad: CanonicalTeamSquad = {
          teamId: homeRaw.team?.id,
          canonicalTeamId: homeResolvedTeamId,
          teamName: homeRaw.team?.name,
          formation: homeRaw.formation || undefined,
          coach: homeRaw.coach?.name || undefined,
          isConfirmed,
          startingXI: homeStartXI,
          bench: homeBench,
          injuriesAndAbsences: [],
          positionCoverage: countPositions(homeStartXI),
        };

        const awaySquad: CanonicalTeamSquad = {
          teamId: awayRaw.team?.id,
          canonicalTeamId: awayResolvedTeamId,
          teamName: awayRaw.team?.name,
          formation: awayRaw.formation || undefined,
          coach: awayRaw.coach?.name || undefined,
          isConfirmed,
          startingXI: awayStartXI,
          bench: awayBench,
          injuriesAndAbsences: [],
          positionCoverage: countPositions(awayStartXI),
        };

        const squadData: CanonicalMatchSquadData = {
          home: homeSquad,
          away: awaySquad,
          provider: this.name,
          retrievedAt: new Date().toISOString(),
          isConfirmed,
        };

        // Strict verification with CanonicalEntityManager
        if (targetMatch) {
          const bindingCheck = cem.verifySquadBinding(targetMatch, squadData);
          if (!bindingCheck.isValid) {
            this.lineupCache.set(cacheKey, {
              data: undefined,
              timestamp: Date.now(),
              ttlMs: 5 * 60 * 1000,
            });
            return {
              data: undefined,
              provenance: {
                provider: this.name,
                retrievedAt: new Date().toISOString(),
                latencyMs,
                rawCount: 0,
              },
            };
          }
        }

        const ttlMs = isConfirmed ? 30 * 60 * 1000 : 10 * 60 * 1000;
        this.lineupCache.set(cacheKey, {
          data: squadData,
          timestamp: Date.now(),
          ttlMs,
        });

        return {
          data: squadData,
          provenance: {
            provider: this.name,
            retrievedAt: new Date().toISOString(),
            latencyMs,
            rawCount: 1,
          },
        };
      } catch {
        return {
          data: undefined,
          provenance: {
            provider: this.name,
            retrievedAt: new Date().toISOString(),
            latencyMs: 0,
            rawCount: 0,
          },
        };
      }
    })();

    this.inFlightLineups.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.inFlightLineups.delete(cacheKey);
    }
  }

  /**
   * Finds verified API-Football fixture ID using real provider query
   */
  async findFixtureId(homeTeamId: number | string, awayTeamId: number | string, date: string): Promise<number | null> {
    if (!this.isConfigured() || !homeTeamId || !awayTeamId || !date) return null;
    try {
      const { data: fixtures } = await this.fetchWithAuth<any[]>(`/fixtures?date=${date}&team=${homeTeamId}`);
      if (!fixtures || !Array.isArray(fixtures)) return null;
      const matched = fixtures.find(
        (f: any) =>
          (String(f.teams?.away?.id) === String(awayTeamId) && String(f.teams?.home?.id) === String(homeTeamId)) ||
          (String(f.teams?.away?.id) === String(homeTeamId) && String(f.teams?.home?.id) === String(awayTeamId))
      );
      return matched?.fixture?.id ? Number(matched.fixture.id) : null;
    } catch {
      return null;
    }
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

    const isAvailable = list.length > 0;

    return {
      data: {
        status: isAvailable ? 'AVAILABLE' : 'MISSING',
        failureReason: isAvailable ? undefined : 'NO_RECORDS',
        matchesCount: list.length,
        homeWins,
        draws,
        awayWins,
        totalGoals,
        avgGoals: isAvailable ? Number((totalGoals / list.length).toFixed(2)) : 0,
        recentMatches,
        source: this.name,
        retrievedAt: new Date().toISOString(),
        confidence: isAvailable ? 1.0 : 0,
      },
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: list.length,
      },
    };
  }

  async searchTeams(query: string): Promise<ProviderResult<Array<{ id: number; name: string; country: string; logo?: string }>>> {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
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

    const { data: rawList, latencyMs } = await this.fetchWithAuth<any[]>(`/teams?search=${encodeURIComponent(trimmed)}`);
    const list = rawList || [];
    const teams = list
      .map((item: any) => ({
        id: item.team?.id,
        name: item.team?.name || '',
        country: item.team?.country || '',
        logo: item.team?.logo,
      }))
      .filter((t: any) => t.id && t.name);

    return {
      data: teams,
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs,
        rawCount: teams.length,
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
