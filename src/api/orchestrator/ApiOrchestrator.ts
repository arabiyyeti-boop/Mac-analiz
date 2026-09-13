// src/api/orchestrator/ApiOrchestrator.ts - API Orchestration, Circuit Breaker & Resilience Layer
import { FootballDataProvider, ProviderFixtureQuery, ProviderResult } from '../providers/FootballDataProvider';
import { FootballDataOrgProvider } from '../providers/FootballDataOrgProvider';
import { ApiFootballProvider } from '../providers/ApiFootballProvider';
import { TheSportsDBProvider } from '../providers/TheSportsDBProvider';
import { NesineMatchProvider } from '../providers/NesineMatchProvider';
import { DataValidator } from '../validation/DataValidator';
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, CanonicalMatchSquadData, ProviderHealth, H2HFailureReason } from '@/types';
import { analysisConfig } from '@/config/analysisConfig';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';
import { CanonicalTeamRecord } from '@/entity/types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
  provider: string;
}

interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastFailureMessage?: string;
  cooldownUntil?: number;
}

export class ApiOrchestrator {
  private static instance: ApiOrchestrator;
  private providers: FootballDataProvider[] = [];
  private cache = new Map<string, CacheEntry<any>>();
  private inFlightRequests = new Map<string, Promise<any>>();
  private circuits = new Map<string, CircuitState>();
  private requestStats = new Map<string, { latencyTotal: number; count: number; timeouts: number; rateLimits: number }>();

  private constructor() {
    // Initialize provider adapters
    this.providers = [
      new FootballDataOrgProvider(),
      new ApiFootballProvider(),
      new TheSportsDBProvider(),
      new NesineMatchProvider(),
    ];

    // Initialize circuits
    for (const p of this.providers) {
      this.circuits.set(p.name, {
        state: 'CLOSED',
        failures: 0,
        successes: 0,
      });
      this.requestStats.set(p.name, {
        latencyTotal: 0,
        count: 0,
        timeouts: 0,
        rateLimits: 0,
      });
    }
  }

  public static getInstance(): ApiOrchestrator {
    if (!ApiOrchestrator.instance) {
      ApiOrchestrator.instance = new ApiOrchestrator();
    }
    return ApiOrchestrator.instance;
  }

  /**
   * Returns current health of all providers
   */
  public getProvidersHealth(): ProviderHealth[] {
    return this.providers.map((p) => {
      const c = this.circuits.get(p.name)!;
      const stats = this.requestStats.get(p.name)!;
      const avgLatency = stats.count > 0 ? Math.round(stats.latencyTotal / stats.count) : 0;

      return {
        name: p.name,
        status: c.state,
        isConfigured: p.isConfigured(),
        latencyMs: avgLatency,
        successfulRequests: c.successes,
        errorCount: c.failures,
        timeoutCount: stats.timeouts,
        rateLimitCount: stats.rateLimits,
        lastFailure: c.lastFailureMessage,
        cooldownUntil: c.cooldownUntil ? new Date(c.cooldownUntil).toISOString() : undefined,
      };
    });
  }

  public hasConfiguredProvider(): boolean {
    return this.providers.some((p) => p.isConfigured());
  }

  /**
   * Main entry point for fetching today's fixtures
   */
  public async getFixtures(query?: ProviderFixtureQuery): Promise<{
    matches: CanonicalMatch[];
    cached: boolean;
    provider: string;
    retrievedAt: string;
  }> {
    const key = `fixtures_${query?.dateFrom || 'today'}_${query?.dateTo || 'today'}`;

    // 1. Check Cache
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return {
        matches: cached.data,
        cached: true,
        provider: cached.provider,
        retrievedAt: new Date(cached.timestamp).toISOString(),
      };
    }

    // 2. Check Deduplication
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    // 3. Multi-provider execution with deduplication and fallback
    const execPromise = (async () => {
      const configured = this.providers.filter((p) => p.isConfigured());
      const allMatches: CanonicalMatch[] = [];
      const seen = new Set<string>();
      const providersUsed: string[] = [];

      for (const provider of configured) {
        const circuit = this.circuits.get(provider.name)!;
        if (circuit.state === 'OPEN') {
          if (circuit.cooldownUntil && Date.now() > circuit.cooldownUntil) {
            circuit.state = 'HALF_OPEN';
          } else {
            continue;
          }
        }

        try {
          const timeoutPromise = new Promise<ProviderResult<CanonicalMatch[]>>((_, reject) =>
            setTimeout(() => reject(new Error(`PROVIDER_TIMEOUT: ${provider.name}`)), analysisConfig.cache.providerTimeoutMs)
          );
          const res = await Promise.race([provider.getFixtures(query), timeoutPromise]);

          circuit.state = 'CLOSED';
          circuit.failures = 0;
          circuit.successes++;
          providersUsed.push(provider.name);

          for (const m of res.data) {
            const sCheck = DataValidator.validateSchema(m);
            const semCheck = DataValidator.validateSemantic(m);
            if (sCheck.isValid && semCheck.isValid) {
              const datePart = (m.utcDate || '').split('T')[0];
              const dedupKey = `${datePart}_${m.homeTeam.name.toLowerCase().trim()}_${m.awayTeam.name.toLowerCase().trim()}`;
              if (!seen.has(dedupKey)) {
                seen.add(dedupKey);
                allMatches.push(m);
              }
            }
          }
        } catch (err: any) {
          circuit.failures++;
          circuit.lastFailureTime = Date.now();
          circuit.lastFailureMessage = err?.message || 'Bilinmeyen hata';
          if (circuit.failures >= 3) {
            circuit.state = 'OPEN';
            circuit.cooldownUntil = Date.now() + 60000;
          }
          console.warn(`[Orchestrator] Provider ${provider.name} failed:`, err?.message);
        }
      }

      if (allMatches.length === 0 && configured.length > 0 && providersUsed.length === 0) {
        throw new Error('Tüm veri sağlayıcıları geçici olarak erişilemez durumda.');
      }

      this.cache.set(key, {
        data: allMatches,
        timestamp: Date.now(),
        ttlMs: analysisConfig.cache.fixturesTtlMs,
        provider: providersUsed.join(', ') || 'none',
      });

      return {
        data: allMatches,
        matches: allMatches,
        cached: false,
        provider: providersUsed.join(', ') || 'none',
        retrievedAt: new Date().toISOString(),
      };
    })();

    this.inFlightRequests.set(key, execPromise);
    try {
      const result = await execPromise;
      return {
        matches: result.matches || result.data,
        cached: result.cached,
        provider: result.provider,
        retrievedAt: result.retrievedAt,
      };
    } finally {
      this.inFlightRequests.delete(key);
    }
  }

  /**
   * Fetches match details & context for analysis
   */
  public async getMatchDetails(matchId: string): Promise<{
    details: {
      match: CanonicalMatch;
      homeForm?: CanonicalForm;
      awayForm?: CanonicalForm;
      h2h?: CanonicalH2H;
      standing?: { home?: CanonicalStanding; away?: CanonicalStanding };
      stats?: CanonicalStats;
      squadData?: CanonicalMatchSquadData;
    };
    cached: boolean;
    provider: string;
    retrievedAt: string;
  }> {
    const key = `match_${matchId}`;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return {
        details: cached.data,
        cached: true,
        provider: cached.provider,
        retrievedAt: new Date(cached.timestamp).toISOString(),
      };
    }

    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const execPromise = (async () => {
      let result: { data: any; cached: boolean; provider: string; retrievedAt: string };
      if (matchId.startsWith('nesine_')) {
        const nesineProv = this.providers.find((p) => p.name === 'nesine') || this.providers[3];
        const res = await nesineProv.getMatchDetails(matchId);
        result = {
          data: res.data,
          cached: false,
          provider: nesineProv.name,
          retrievedAt: new Date().toISOString(),
        };
      } else if (matchId.startsWith('tsdb_')) {
        const tsdbProv = this.providers.find((p) => p.name === 'TheSportsDB');
        if (!tsdbProv) throw new Error('TheSportsDB sağlayıcısı bulunamadı');
        const res = await tsdbProv.getMatchDetails(matchId);
        result = {
          data: res.data,
          cached: false,
          provider: tsdbProv.name,
          retrievedAt: new Date().toISOString(),
        };
      } else {
        result = await this.executeWithResilience<any>(
          key,
          async (provider) => {
            const res = await provider.getMatchDetails(matchId);
            return { data: res.data, latencyMs: res.provenance.latencyMs };
          },
          analysisConfig.cache.matchDetailsTtlMs
        );
      }

      if (result.data?.match) {
        result.data.h2h = await this.resolveAndVerifyH2H(result.data.match, result.data.h2h);
        if (!result.data.squadData) {
          result.data.squadData = await this.resolveAndVerifySquad(result.data.match);
        }
      }

      // Store in details cache
      this.cache.set(key, {
        data: result.data,
        timestamp: Date.now(),
        ttlMs: analysisConfig.cache.matchDetailsTtlMs,
        provider: result.provider,
      });

      return result;
    })();

    this.inFlightRequests.set(key, execPromise);
    try {
      const result = await execPromise;
      return {
        details: result.data,
        cached: result.cached,
        provider: result.provider,
        retrievedAt: result.retrievedAt,
      };
    } finally {
      this.inFlightRequests.delete(key);
    }
  }

  /**
   * Enriched H2H Resolution & Verification with Canonical Matching and Deterministic Caching
   */
  private async resolveAndVerifyH2H(
    targetMatch: CanonicalMatch,
    existingH2h?: CanonicalH2H
  ): Promise<CanonicalH2H> {
    const cem = CanonicalEntityManager.getInstance();
    const homeRes = cem.resolveTeam({
      name: targetMatch.homeTeam.name,
      country: targetMatch.league?.country,
      sourceId: targetMatch.homeTeam.id,
      provider: targetMatch.provider,
    });
    const awayRes = cem.resolveTeam({
      name: targetMatch.awayTeam.name,
      country: targetMatch.league?.country,
      sourceId: targetMatch.awayTeam.id,
      provider: targetMatch.provider,
    });

    const homeCanonicalId = homeRes.team?.canonicalTeamId || targetMatch.homeTeam.name.toLowerCase().trim();
    const awayCanonicalId = awayRes.team?.canonicalTeamId || targetMatch.awayTeam.name.toLowerCase().trim();

    // 7. Cache/Dedupe: Canonical iki takım ID’sinden, home/away sırasından bağımsız deterministik H2H cache anahtarı
    const teamIds = [homeCanonicalId, awayCanonicalId].sort();
    const h2hCacheKey = `h2h_${teamIds[0]}_${teamIds[1]}`;

    const cachedH2h = this.cache.get(h2hCacheKey);
    if (cachedH2h && Date.now() - cachedH2h.timestamp < cachedH2h.ttlMs) {
      return cachedH2h.data;
    }

    // In-flight deduplication: return existing pending promise for this pair
    if (this.inFlightRequests.has(h2hCacheKey)) {
      return this.inFlightRequests.get(h2hCacheKey);
    }

    const h2hPromise = (async (): Promise<CanonicalH2H> => {
      // Default missing structure
      const createMissingH2H = (failureReason: H2HFailureReason = 'NO_RECORDS', source = 'none'): CanonicalH2H => ({
        status: 'MISSING',
        failureReason,
        matchesCount: 0,
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        totalGoals: 0,
        avgGoals: 0,
        recentMatches: [],
        source,
        retrievedAt: new Date().toISOString(),
        confidence: 0,
      });

      // 1. Check configured real H2H providers
      const realH2hProviders = this.providers.filter((p) => p.name !== 'nesine' && p.isConfigured());

      if (realH2hProviders.length === 0) {
        return createMissingH2H('PROVIDER_NOT_CONFIGURED', 'orchestrator');
      }

      // Check if team resolution is ambiguous
      const isAmbiguous =
        !homeRes.team ||
        !awayRes.team ||
        homeRes.confidence < 0.6 ||
        awayRes.confidence < 0.6 ||
        homeRes.reason?.includes('ENTITY_AMBIGUOUS') ||
        awayRes.reason?.includes('ENTITY_AMBIGUOUS');

      if (isAmbiguous) {
        return createMissingH2H('TEAM_ID_UNRESOLVED', 'orchestrator');
      }

      let resolvedH2h: CanonicalH2H | null = existingH2h && existingH2h.status !== 'MISSING' ? existingH2h : null;
      let lastFailureReason: H2HFailureReason = 'NO_RECORDS';

      if (!resolvedH2h) {
        const providerResults: { providerName: string; h2h: CanonicalH2H }[] = [];

        for (const prov of realH2hProviders) {
          try {
            let homeSourceId = homeRes.team?.sourceTeamIds.find((s) => s.provider === prov.name)?.sourceId ||
              (homeRes.team?.sourceTeamIds.find((s) => s.provider === prov.name) as any)?.sourceTeamId;
            let awaySourceId = awayRes.team?.sourceTeamIds.find((s) => s.provider === prov.name)?.sourceId ||
              (awayRes.team?.sourceTeamIds.find((s) => s.provider === prov.name) as any)?.sourceTeamId;

            // Priority B: If missing from CanonicalTeamRecord, resolve using provider search
            if (!homeSourceId && homeRes.team) {
              const resolved = await this.resolveProviderTeamId(
                prov,
                homeRes.team,
                targetMatch.league?.country,
                targetMatch.league?.name
              );
              if (resolved) homeSourceId = resolved;
            }

            if (!awaySourceId && awayRes.team) {
              const resolved = await this.resolveProviderTeamId(
                prov,
                awayRes.team,
                targetMatch.league?.country,
                targetMatch.league?.name
              );
              if (resolved) awaySourceId = resolved;
            }

            if (!homeSourceId || !awaySourceId) {
              lastFailureReason = 'TEAM_ID_UNRESOLVED';
              continue;
            }

            const provRes = await prov.getH2H(homeSourceId, awaySourceId);
            if (provRes.data) {
              if (provRes.data.status === 'AVAILABLE' && provRes.data.recentMatches && provRes.data.recentMatches.length > 0) {
                providerResults.push({ providerName: prov.name, h2h: provRes.data });
              } else {
                lastFailureReason = provRes.data.failureReason || 'NO_RECORDS';
              }
            }
          } catch (err: any) {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('rate_limit') || msg.includes('ratelimit') || msg.includes('429')) {
              lastFailureReason = 'RATE_LIMITED';
            } else if (msg.includes('timeout')) {
              lastFailureReason = 'PROVIDER_TIMEOUT';
            } else if (msg.includes('not_configured')) {
              lastFailureReason = 'PROVIDER_NOT_CONFIGURED';
            } else {
              lastFailureReason = 'PROVIDER_ERROR';
            }
          }
        }

        // 8. Cross-source conflict:
        if (providerResults.length > 1) {
          const [first, second] = providerResults;
          const matchesCountDiff = Math.abs(first.h2h.matchesCount - second.h2h.matchesCount);
          const homeWinsDiff = Math.abs(first.h2h.homeWins - second.h2h.homeWins);
          const awayWinsDiff = Math.abs(first.h2h.awayWins - second.h2h.awayWins);

          const hasConflict = matchesCountDiff > 2 || homeWinsDiff > 2 || awayWinsDiff > 2;

          resolvedH2h = first.h2h;
          if (hasConflict) {
            resolvedH2h.status = 'CONFLICTING';
            resolvedH2h.failureReason = 'CONFLICTING_DATA';
            resolvedH2h.confidence = 0.4;
          }
        } else if (providerResults.length === 1) {
          resolvedH2h = providerResults[0].h2h;
        } else {
          resolvedH2h = createMissingH2H(lastFailureReason, 'api-football');
        }
      }

      // 2. H2H: Mevcut CanonicalEntityManager.verifyH2HBinding() kullanılsın.
      if (resolvedH2h && resolvedH2h.status === 'AVAILABLE' && resolvedH2h.recentMatches && resolvedH2h.recentMatches.length > 0) {
        const verification = cem.verifyH2HBinding(targetMatch, resolvedH2h);
        if (!verification.isValid) {
          resolvedH2h.status = 'LOW_CONFIDENCE';
          resolvedH2h.failureReason = 'BINDING_FAILED';
          resolvedH2h.confidence = 0.3;
        }
      }

      // Store in cache (Requirement 7)
      this.cache.set(h2hCacheKey, {
        data: resolvedH2h,
        timestamp: Date.now(),
        ttlMs: analysisConfig.cache.matchDetailsTtlMs,
        provider: resolvedH2h.source || 'orchestrator',
      });

      return resolvedH2h;
    })();

    this.inFlightRequests.set(h2hCacheKey, h2hPromise);
    try {
      return await h2hPromise;
    } finally {
      this.inFlightRequests.delete(h2hCacheKey);
    }
  }

  /**
   * Resolves and verifies squad lineup data using real API-Football provider.
   * Strictly adheres to Zero-Invention Guarantee: if no verified fixture ID or real lineup exists, returns undefined.
   */
  private async resolveAndVerifySquad(
    targetMatch: CanonicalMatch
  ): Promise<CanonicalMatchSquadData | undefined> {
    const apiFootballProv = this.providers.find((p) => p.name === 'api-football');
    if (!apiFootballProv || !apiFootballProv.isConfigured() || !apiFootballProv.getLineups) {
      return undefined;
    }

    const squadCacheKey = `squad_orchestrator_${targetMatch.id}`;
    const cached = this.cache.get(squadCacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data;
    }

    // Determine verified API-Football fixture ID
    let verifiedFixtureId: number | string | null = null;
    if (targetMatch.provider === 'api-football' && targetMatch.id && !isNaN(Number(targetMatch.id))) {
      verifiedFixtureId = targetMatch.id;
    } else if (targetMatch.externalId && !isNaN(Number(targetMatch.externalId))) {
      verifiedFixtureId = targetMatch.externalId;
    } else {
      // Resolve teams and find fixture without fabricating IDs
      try {
        const cem = CanonicalEntityManager.getInstance();
        const homeTeamRec = cem.getTeamRecord(targetMatch.homeTeam.name);
        const awayTeamRec = cem.getTeamRecord(targetMatch.awayTeam.name);
        if (homeTeamRec && awayTeamRec) {
          const homeSourceId = await this.resolveProviderTeamId(apiFootballProv, homeTeamRec, targetMatch.league?.country);
          const awaySourceId = await this.resolveProviderTeamId(apiFootballProv, awayTeamRec, targetMatch.league?.country);
          if (homeSourceId && awaySourceId && targetMatch.utcDate && apiFootballProv.findFixtureId) {
            const matchDate = targetMatch.utcDate.split('T')[0];
            verifiedFixtureId = await apiFootballProv.findFixtureId(homeSourceId, awaySourceId, matchDate);
          }
        }
      } catch {
        verifiedFixtureId = null;
      }
    }

    if (!verifiedFixtureId) {
      // Gerçek doğrulanmış API-Football fixture ID yoksa lineup endpoint çağrısı yapma ve MISSING dön
      return undefined;
    }

    try {
      const res = await apiFootballProv.getLineups(verifiedFixtureId, targetMatch);
      if (res?.data) {
        this.cache.set(squadCacheKey, {
          data: res.data,
          timestamp: Date.now(),
          ttlMs: res.data.isConfirmed ? 30 * 60 * 1000 : 10 * 60 * 1000,
          provider: apiFootballProv.name,
        });
      }
      return res?.data;
    } catch {
      return undefined;
    }
  }

  /**
   * Resolves API-Football team ID for a canonical team using Priority A and Priority B.
   * Priority A: Already bound sourceTeamId in CanonicalTeamRecord.
   * Priority B: Provider's real team search + strict verification (country + normalized name + aliases).
   */
  private async resolveProviderTeamId(
    prov: FootballDataProvider,
    team: CanonicalTeamRecord,
    leagueCountry?: string,
    competitionName?: string
  ): Promise<string | null> {
    // Priority A: Direct verified sourceTeamId
    const existingSourceId = team.sourceTeamIds.find(
      (s) => s.provider.toLowerCase() === prov.name.toLowerCase()
    )?.sourceId || (team.sourceTeamIds.find(
      (s) => s.provider.toLowerCase() === prov.name.toLowerCase()
    ) as any)?.sourceTeamId;

    if (existingSourceId) {
      return String(existingSourceId);
    }

    // Only if provider supports searchTeams and is configured
    if (!prov.searchTeams || !prov.isConfigured()) {
      return null;
    }

    const mappingCacheKey = `team_prov_id_${prov.name}_${team.canonicalTeamId}`;
    const cached = this.cache.get(mappingCacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data;
    }

    // Deduplicate in-flight resolution
    const inFlightKey = `inflight_team_${prov.name}_${team.canonicalTeamId}`;
    if (this.inFlightRequests.has(inFlightKey)) {
      return this.inFlightRequests.get(inFlightKey);
    }

    const resolutionPromise = (async (): Promise<string | null> => {
      try {
        const cem = CanonicalEntityManager.getInstance();
        const queryCandidates = [
          team.normalizedName,
          team.officialName.replace(/\b(football club|futbol kulubu|fk|sk|sc|cf|ac|as|spor kulubu)\b/gi, '').trim(),
        ].filter((q) => q && q.length >= 3);

        const query = queryCandidates[0] || team.normalizedName;
        const searchRes = await prov.searchTeams!(query);
        const candidates = searchRes.data || [];

        if (candidates.length === 0) {
          this.cache.set(mappingCacheKey, {
            data: null,
            timestamp: Date.now(),
            ttlMs: 3600 * 1000,
            provider: prov.name,
          });
          return null;
        }

        const normCountry = (c: string) => {
          const lower = c.toLowerCase().trim();
          if (lower === 'türkiye' || lower === 'turkey' || lower === 'tr') return 'turkey';
          if (lower === 'england' || lower === 'united kingdom' || lower === 'gb') return 'england';
          if (lower === 'spain' || lower === 'españa' || lower === 'es') return 'spain';
          if (lower === 'germany' || lower === 'deutschland' || lower === 'de') return 'germany';
          if (lower === 'italy' || lower === 'italia' || lower === 'it') return 'italy';
          if (lower === 'france' || lower === 'fr') return 'france';
          if (lower === 'qatar' || lower === 'qa') return 'qatar';
          return lower;
        };

        const targetCountry = normCountry(team.country || leagueCountry || '');

        const targetExact = cem.exactNormalize(team.officialName);
        const targetNorm = cem.normalizeName(team.normalizedName);
        const aliasNorms = team.aliases.map((a) => cem.normalizeName(a));
        const aliasExacts = team.aliases.map((a) => cem.exactNormalize(a));

        const matchedCandidates: typeof candidates = [];

        for (const cand of candidates) {
          if (targetCountry && cand.country) {
            const candCountry = normCountry(cand.country);
            if (candCountry && candCountry !== targetCountry) {
              continue;
            }
          }

          const candNorm = cem.normalizeName(cand.name);
          const candExact = cem.exactNormalize(cand.name);

          const isMatch =
            candNorm === targetNorm ||
            candExact === targetExact ||
            aliasNorms.includes(candNorm) ||
            aliasExacts.includes(candExact);

          if (isMatch) {
            matchedCandidates.push(cand);
          }
        }

        // Ambiguity guard: If not exactly 1 candidate, do not guess
        if (matchedCandidates.length !== 1) {
          this.cache.set(mappingCacheKey, {
            data: null,
            timestamp: Date.now(),
            ttlMs: 3600 * 1000,
            provider: prov.name,
          });
          return null;
        }

        const verifiedId = String(matchedCandidates[0].id);
        const verifiedLogo = matchedCandidates[0].logo;

        // Section 3: Canonical Mapping Kalıcılığı - server-side bind to canonical entity
        cem.bindSourceTeamId(team.canonicalTeamId, prov.name, verifiedId);

        // Bind verified real logo from provider and populate team_logo_ cache
        if (verifiedLogo && typeof verifiedLogo === 'string') {
          cem.bindVerifiedLogo(team.canonicalTeamId, prov.name, verifiedId, verifiedLogo);
          this.cache.set(`team_logo_${team.canonicalTeamId}`, {
            data: verifiedLogo,
            timestamp: Date.now(),
            ttlMs: 7 * 24 * 3600 * 1000,
            provider: prov.name,
          });
        }

        // Cache mapping for 7 days
        this.cache.set(mappingCacheKey, {
          data: verifiedId,
          timestamp: Date.now(),
          ttlMs: 7 * 24 * 3600 * 1000,
          provider: prov.name,
        });

        return verifiedId;
      } catch {
        return null;
      }
    })();

    this.inFlightRequests.set(inFlightKey, resolutionPromise);
    try {
      return await resolutionPromise;
    } finally {
      this.inFlightRequests.delete(inFlightKey);
    }
  }

  /**
   * Retrieves verified team logo using deterministic team_logo_ cache and canonical binding
   */
  public getVerifiedTeamLogo(canonicalTeamId: string): string | undefined {
    const cem = CanonicalEntityManager.getInstance();
    const team = cem.getTeam(canonicalTeamId);

    // 1. Check verified logo on CanonicalTeamRecord
    if (team?.logoUrl && team.logoSource !== 'DYNAMIC_UNVERIFIED') {
      return team.logoUrl;
    }

    // 2. Check team_logo_ cache
    const cacheKey = `team_logo_${canonicalTeamId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      return cached.data;
    }

    return undefined;
  }

  /**
   * Resilient execution engine with Circuit Breaker, Timeout, and Provider Fallback
   */
  private async executeWithResilience<T>(
    cacheKey: string,
    operation: (provider: FootballDataProvider) => Promise<{ data: T; latencyMs: number }>,
    ttlMs: number
  ): Promise<{ data: T; cached: boolean; provider: string; retrievedAt: string }> {
    const configuredProviders = this.providers.filter((p) => p.isConfigured());

    if (configuredProviders.length === 0) {
      throw new Error('PROVIDER_UNCONFIGURED: Hiçbir futbol veri sağlayıcısı (API key) yapılandırılmadı. Lütfen .env dosyasında FOOTBALL_DATA_ORG_KEY veya API_FOOTBALL_KEY tanımlayınız.');
    }

    let lastError: Error | null = null;

    for (const provider of configuredProviders) {
      const circuit = this.circuits.get(provider.name)!;
      const stats = this.requestStats.get(provider.name)!;

      // Check circuit state
      if (circuit.state === 'OPEN') {
        if (circuit.cooldownUntil && Date.now() > circuit.cooldownUntil) {
          circuit.state = 'HALF_OPEN';
        } else {
          continue; // skip this provider
        }
      }

      // Attempt operation with timeout and retry
      try {
        const timeoutPromise = new Promise<{ data: T; latencyMs: number }>((_, reject) =>
          setTimeout(() => {
            stats.timeouts++;
            reject(new Error(`PROVIDER_TIMEOUT: ${provider.name} request timed out after ${analysisConfig.cache.providerTimeoutMs}ms`));
          }, analysisConfig.cache.providerTimeoutMs)
        );

        const result = await Promise.race([operation(provider), timeoutPromise]);

        // Success: update circuit
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        circuit.successes++;
        stats.count++;
        stats.latencyTotal += result.latencyMs;

        // Store in cache
        this.cache.set(cacheKey, {
          data: result.data,
          timestamp: Date.now(),
          ttlMs,
          provider: provider.name,
        });

        return {
          data: result.data,
          cached: false,
          provider: provider.name,
          retrievedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        lastError = err;
        circuit.failures++;
        if (err.message?.includes('RATE_LIMIT')) {
          stats.rateLimits++;
        }

        // Trip circuit if failures exceed threshold
        if (circuit.failures >= analysisConfig.cache.circuitBreakerErrorThreshold) {
          circuit.state = 'OPEN';
          circuit.cooldownUntil = Date.now() + analysisConfig.cache.circuitBreakerCooldownMs;
        }
      }
    }

    // Check if stale cache is available
    const staleEntry = this.cache.get(cacheKey);
    if (staleEntry) {
      return {
        data: staleEntry.data,
        cached: true,
        provider: `${staleEntry.provider} (STALE)`,
        retrievedAt: new Date(staleEntry.timestamp).toISOString(),
      };
    }

    throw lastError || new Error('PROVIDER_UNAVAILABLE: Tüm veri sağlayıcılar başarısız oldu.');
  }
}
