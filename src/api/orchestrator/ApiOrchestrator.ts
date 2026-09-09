// src/api/orchestrator/ApiOrchestrator.ts - API Orchestration, Circuit Breaker & Resilience Layer
import { FootballDataProvider, ProviderFixtureQuery, ProviderResult } from '../providers/FootballDataProvider';
import { FootballDataOrgProvider } from '../providers/FootballDataOrgProvider';
import { ApiFootballProvider } from '../providers/ApiFootballProvider';
import { NesineMatchProvider } from '../providers/NesineMatchProvider';
import { DataValidator } from '../validation/DataValidator';
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, ProviderHealth } from '@/types';
import { analysisConfig } from '@/config/analysisConfig';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';

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

    // 3. Execute with fallback & retry
    const execPromise = this.executeWithResilience<CanonicalMatch[]>(key, async (provider) => {
      const res = await provider.getFixtures(query);
      // Validate schema of returned fixtures
      const validated: CanonicalMatch[] = [];
      for (const m of res.data) {
        const sCheck = DataValidator.validateSchema(m);
        const semCheck = DataValidator.validateSemantic(m);
        if (sCheck.isValid && semCheck.isValid) {
          validated.push(m);
        }
      }
      return { data: validated, latencyMs: res.provenance.latencyMs };
    }, analysisConfig.cache.fixturesTtlMs);

    this.inFlightRequests.set(key, execPromise);
    try {
      const result = await execPromise;
      return {
        matches: result.data,
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
        const nesineProv = this.providers.find((p) => p.name === 'nesine') || this.providers[2];
        const res = await nesineProv.getMatchDetails(matchId);
        result = {
          data: res.data,
          cached: false,
          provider: nesineProv.name,
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
    const homeRes = cem.resolveTeam({ name: targetMatch.homeTeam.name });
    const awayRes = cem.resolveTeam({ name: targetMatch.awayTeam.name });

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
      const createMissingH2H = (source = 'none'): CanonicalH2H => ({
        status: 'MISSING',
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

      let resolvedH2h: CanonicalH2H = existingH2h || createMissingH2H();

      // Check if team resolution is ambiguous
      const isAmbiguous =
        !homeRes.team ||
        !awayRes.team ||
        homeRes.confidence < 0.6 ||
        awayRes.confidence < 0.6 ||
        homeRes.reason?.includes('ENTITY_AMBIGUOUS') ||
        awayRes.reason?.includes('ENTITY_AMBIGUOUS');

      // 1. ApiOrchestrator: Nesine maçı için, yalnızca gerçek ve configured bir H2H provider varsa H2H sorgula.
      // API-Football aktif değilse hiçbir sahte istek yapma; H2H MISSING kalsın.
      const realH2hProviders = this.providers.filter((p) => p.name !== 'nesine' && p.isConfigured());

      if (realH2hProviders.length > 0 && !isAmbiguous && (!existingH2h || existingH2h.status === 'MISSING')) {
        const providerResults: { providerName: string; h2h: CanonicalH2H }[] = [];

        for (const prov of realH2hProviders) {
          try {
            const homeSourceId = homeRes.team?.sourceTeamIds.find((s) => s.provider === prov.name)?.sourceId ||
              (homeRes.team?.sourceTeamIds.find((s) => s.provider === prov.name) as any)?.sourceTeamId;
            const awaySourceId = awayRes.team?.sourceTeamIds.find((s) => s.provider === prov.name)?.sourceId ||
              (awayRes.team?.sourceTeamIds.find((s) => s.provider === prov.name) as any)?.sourceTeamId;

            if (homeSourceId && awaySourceId) {
              const provRes = await prov.getH2H(homeSourceId, awaySourceId);
              if (provRes.data && provRes.data.status !== 'MISSING' && provRes.data.recentMatches.length > 0) {
                providerResults.push({ providerName: prov.name, h2h: provRes.data });
              }
            }
          } catch {
            // Gracefully skip failed provider
          }
        }

        // 8. Cross-source conflict:
        // Birden fazla gerçek H2H provider aktif olduğunda çözülemeyen skor/tarih/takım çelişkisini CONFLICTING olarak işaretle.
        // Tek provider durumunda gereksiz conflict üretme.
        if (providerResults.length > 1) {
          const [first, second] = providerResults;
          const matchesCountDiff = Math.abs(first.h2h.matchesCount - second.h2h.matchesCount);
          const homeWinsDiff = Math.abs(first.h2h.homeWins - second.h2h.homeWins);
          const awayWinsDiff = Math.abs(first.h2h.awayWins - second.h2h.awayWins);

          const hasConflict = matchesCountDiff > 2 || homeWinsDiff > 2 || awayWinsDiff > 2;

          resolvedH2h = first.h2h;
          if (hasConflict) {
            resolvedH2h.status = 'CONFLICTING';
            resolvedH2h.confidence = 0.4;
          }
        } else if (providerResults.length === 1) {
          resolvedH2h = providerResults[0].h2h;
        }
      }

      // 2. H2H: Mevcut CanonicalEntityManager.verifyH2HBinding() kullanılsın.
      // Home/away reversal kabul edilsin, üçüncü takım kayıtları reddedilsin, belirsiz eşleşmeler reddedilsin.
      if (resolvedH2h && resolvedH2h.status !== 'MISSING' && resolvedH2h.recentMatches && resolvedH2h.recentMatches.length > 0) {
        const verification = cem.verifyH2HBinding(targetMatch, resolvedH2h);
        if (!verification.isValid) {
          resolvedH2h.status = 'LOW_CONFIDENCE';
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
