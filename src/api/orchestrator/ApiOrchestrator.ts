// src/api/orchestrator/ApiOrchestrator.ts - API Orchestration, Circuit Breaker & Resilience Layer
import { FootballDataProvider, ProviderFixtureQuery, ProviderResult } from '../providers/FootballDataProvider';
import { FootballDataOrgProvider } from '../providers/FootballDataOrgProvider';
import { ApiFootballProvider } from '../providers/ApiFootballProvider';
import { DataValidator } from '../validation/DataValidator';
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, ProviderHealth } from '@/types';
import { analysisConfig } from '@/config/analysisConfig';

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

    const execPromise = this.executeWithResilience<any>(key, async (provider) => {
      const res = await provider.getMatchDetails(matchId);
      return { data: res.data, latencyMs: res.provenance.latencyMs };
    }, analysisConfig.cache.matchDetailsTtlMs);

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
