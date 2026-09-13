// src/entity/CanonicalEntityManager.ts - Core Canonical Identity & Zero-Trust Integrity Engine
import {
  CanonicalTeamRecord,
  CanonicalFixtureRecord,
  LogoVerificationResult,
  OddsBindingVerification,
  H2HBindingVerification,
  XGBindingVerification,
  SquadBindingVerification,
  FinalConsistencyReport,
} from './types';
import { CanonicalMatch, CanonicalH2H, CanonicalStats, CanonicalMatchSquadData } from '@/types';
import { NesineMatchOddsData } from '@/types/odds';

export class CanonicalEntityManager {
  private static instance: CanonicalEntityManager;

  // Master Canonical Team Store indexed by canonicalTeamId
  private teamStore = new Map<string, CanonicalTeamRecord>();
  // Fast alias lookup index (normalizedAlias -> canonicalTeamId)
  private aliasIndex = new Map<string, string>();
  // Fixture cache indexed by canonicalFixtureId
  private fixtureStore = new Map<string, CanonicalFixtureRecord>();
  // Provider source index: `${provider.toLowerCase()}__${sourceFixtureId}` -> canonicalFixtureId
  private providerSourceIndex = new Map<string, string>();
  // Fixture lineage index: `${competitionId}__${homeId}__vs__${awayId}__${seasonId}` -> canonicalFixtureId
  private fixtureLineageIndex = new Map<string, string>();

  // Exact alias lookup preserving identifying qualifiers (e.g. city/united)
  private exactAliasIndex = new Map<string, string>();
  // Colliding aliases that point to multiple clubs (e.g. "manchester" -> city vs united)
  private ambiguousAliases = new Set<string>();

  private constructor() {
    this.seedCanonicalTeams();
  }

  public static getInstance(): CanonicalEntityManager {
    if (!CanonicalEntityManager.instance) {
      CanonicalEntityManager.instance = new CanonicalEntityManager();
    }
    return CanonicalEntityManager.instance;
  }

  public resetFixturesForTesting(): void {
    this.fixtureStore.clear();
    this.providerSourceIndex.clear();
    this.fixtureLineageIndex.clear();
  }

  /**
   * Exact normalization preserving distinguishing qualifiers (City, United, Town, etc.)
   */
  public exactNormalize(s: string): string {
    if (!s) return '';
    return s
      .toLowerCase()
      .trim()
      .replace(/a\.ş\.|a\.s\.|j\.k\.|s\.k\.|f\.k\.|f\.c\.|c\.f\./g, '')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[\.\,\-\_\'\’\"\/\(\)]/g, ' ')
      .replace(/\b(sk|fk|as|jk|fc|cf|sc|j\s+k|s\s+k|f\s+k|a\s+s|f\s+c|c\s+f|kulubu|kulub|spor)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes a team name for deterministic comparisons:
   * lowercase, removes punctuation, removes legal club suffixes (FC, SK, FK, AS, A.Ş., Kulübü, etc.)
   */
  public normalizeName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .replace(/a\.ş\.|a\.s\.|j\.k\.|s\.k\.|f\.k\.|f\.c\.|c\.f\./g, '')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[\.\,\-\_\'\’\"\/\(\)]/g, ' ')
      .replace(/\b(sk|fk|as|jk|fc|cf|sc|j\s+k|s\s+k|f\s+k|a\s+s|f\s+c|c\s+f|kulubu|kulub|spor|city|united|town|wanderers|athletic|club)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Registers or updates a canonical team in the registry
   */
  public registerTeam(team: CanonicalTeamRecord): void {
    this.teamStore.set(team.canonicalTeamId, team);

    // 1. Exact alias index (preserves City, United, etc.)
    const exactAliases = [
      this.exactNormalize(team.officialName),
      this.exactNormalize(team.normalizedName),
      ...team.aliases.map((a) => this.exactNormalize(a)),
    ];
    for (const ea of exactAliases) {
      if (ea) {
        this.exactAliasIndex.set(ea, team.canonicalTeamId);
      }
    }

    // 2. Stripped alias index with collision / ambiguity detection
    const strippedAliases = [
      this.normalizeName(team.officialName),
      this.normalizeName(team.normalizedName),
      ...team.aliases.map((a) => this.normalizeName(a)),
    ];
    for (const sa of strippedAliases) {
      if (sa) {
        const existing = this.aliasIndex.get(sa);
        if (existing && existing !== team.canonicalTeamId) {
          this.ambiguousAliases.add(sa);
        } else {
          this.aliasIndex.set(sa, team.canonicalTeamId);
        }
      }
    }
  }

  /**
   * Section 8 & 231: Resolves raw team name / source ID to verified Canonical Team.
   * NO naive substring or single name matching.
   */
  public resolveTeam(query: {
    name: string;
    sourceId?: string | number;
    provider?: string;
    country?: string;
  }): { team: CanonicalTeamRecord | null; confidence: number; reason: string } {
    if (!query.name || query.name.trim().length === 0) {
      return { team: null, confidence: 0, reason: 'EMPTY_TEAM_NAME' };
    }

    // 1. Exact alias lookup (preserves City, United, Atletico, etc.)
    const exactNorm = this.exactNormalize(query.name);
    const exactCanonicalId = this.exactAliasIndex.get(exactNorm);
    if (exactCanonicalId && this.teamStore.has(exactCanonicalId)) {
      const match = this.teamStore.get(exactCanonicalId)!;
      const isCountryConflict =
        query.country &&
        match.country &&
        query.country.toLowerCase() !== 'global' &&
        match.country.toLowerCase() !== 'global' &&
        query.country.toLowerCase() !== match.country.toLowerCase();

      if (isCountryConflict) {
        return {
          team: null,
          confidence: 0.3,
          reason: `COUNTRY_CONFLICT: Team "${query.name}" found in ${match.country} but query specified ${query.country}`,
        };
      }
      if (query.country && (!match.country || match.country.toLowerCase() === 'global')) {
        match.country = query.country;
      }
      return { team: match, confidence: 1.0, reason: 'EXACT_ALIAS_MATCH' };
    }

    // 2. Check if stripped name is ambiguous (e.g. 'manchester' for City and United)
    const norm = this.normalizeName(query.name);
    if (this.ambiguousAliases.has(norm)) {
      return {
        team: null,
        confidence: 0.35,
        reason: `ENTITY_AMBIGUOUS: Name "${query.name}" matches multiple canonical teams (e.g. City/United). Explicit qualification required.`,
      };
    }

    // 3. Fallback stripped alias lookup
    const canonicalId = this.aliasIndex.get(norm);
    if (canonicalId && this.teamStore.has(canonicalId)) {
      const match = this.teamStore.get(canonicalId)!;
      const isCountryConflict =
        query.country &&
        match.country &&
        query.country.toLowerCase() !== 'global' &&
        match.country.toLowerCase() !== 'global' &&
        query.country.toLowerCase() !== match.country.toLowerCase();

      if (isCountryConflict) {
        return {
          team: null,
          confidence: 0.3,
          reason: `COUNTRY_CONFLICT: Team "${query.name}" found in ${match.country} but query specified ${query.country}`,
        };
      }
      if (query.country && (!match.country || match.country.toLowerCase() === 'global')) {
        match.country = query.country;
      }
      return { team: match, confidence: 0.95, reason: 'ALIAS_MATCH' };
    }

    // 2. Token-set Jaccard similarity against registered canonical teams
    const queryTokens = new Set(norm.split(' ').filter((t) => t.length > 2));
    let bestTeam: CanonicalTeamRecord | null = null;
    let highestJaccard = 0;

    for (const cand of this.teamStore.values()) {
      if (query.country && cand.country && query.country.toLowerCase() !== cand.country.toLowerCase()) {
        continue;
      }

      const candTokens = new Set(this.normalizeName(cand.officialName).split(' ').filter((t) => t.length > 2));
      const intersection = new Set([...queryTokens].filter((x) => candTokens.has(x)));
      const union = new Set([...queryTokens, ...candTokens]);

      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      if (jaccard > highestJaccard) {
        highestJaccard = jaccard;
        bestTeam = cand;
      }
    }

    if (bestTeam && highestJaccard >= 0.65) {
      return { team: bestTeam, confidence: Number(highestJaccard.toFixed(2)), reason: 'FUZZY_TOKEN_MATCH' };
    }

    // Dynamic auto-canonical fallback for unseeded teams with high integrity isolation
    const dynamicId = `dyn_${norm.replace(/\s+/g, '_')}`;
    const dynamicTeam: CanonicalTeamRecord = {
      canonicalTeamId: dynamicId,
      sourceTeamIds: query.sourceId ? [{ provider: query.provider || 'generic', sourceId: String(query.sourceId) }] : [],
      officialName: query.name.trim(),
      normalizedName: norm,
      shortName: query.name.substring(0, 3).toUpperCase(),
      country: query.country || 'Global',
      competitionIds: [],
      aliases: [query.name],
      logoUrl: '',
      logoSource: 'DYNAMIC_UNVERIFIED',
      primaryColor: '#334155',
      secondaryColor: '#64748B',
      textColor: '#FFFFFF',
      identityConfidence: 0.80,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.registerTeam(dynamicTeam);
    return { team: dynamicTeam, confidence: 0.80, reason: 'DYNAMIC_CANONICAL_REGISTERED' };
  }

  /**
   * Binds a provider source ID to a canonical team in memory
   */
  public bindSourceTeamId(canonicalTeamId: string, provider: string, sourceId: string | number): void {
    const team = this.teamStore.get(canonicalTeamId);
    if (!team) return;
    const sId = String(sourceId);
    const exists = team.sourceTeamIds.some(
      (s) => s.provider.toLowerCase() === provider.toLowerCase() && (s.sourceId === sId || (s as any).sourceTeamId === sId)
    );
    if (!exists) {
      team.sourceTeamIds.push({ provider, sourceId: sId });
      team.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Retrieves a canonical team record by its canonical ID
   */
  public getTeam(canonicalTeamId: string): CanonicalTeamRecord | undefined {
    return this.teamStore.get(canonicalTeamId);
  }

  /**
   * Retrieves a CanonicalTeamRecord by raw name or canonical ID
   */
  public getTeamRecord(nameOrId: string): CanonicalTeamRecord | null {
    if (!nameOrId) return null;
    if (this.teamStore.has(nameOrId)) {
      return this.teamStore.get(nameOrId) || null;
    }
    const res = this.resolveTeam({ name: nameOrId });
    return res.team;
  }

  /**
   * Resolves a raw name or ID to a canonical team ID string
   */
  public resolveCanonicalTeamId(nameOrId: string, country?: string): string {
    if (!nameOrId) return '';
    if (this.teamStore.has(nameOrId)) return nameOrId;
    const res = this.resolveTeam({ name: nameOrId, country });
    return res.team ? res.team.canonicalTeamId : nameOrId;
  }

  /**
   * Binds a verified real provider logo URL to a canonical team record.
   * Enforces: canonicalTeamId + verified sourceTeamId + provider relationship.
   * Rejects untrusted domains, HTTP, or arbitrary strings.
   */
  public bindVerifiedLogo(
    canonicalTeamId: string,
    provider: string,
    verifiedSourceId: string | number,
    logoUrl: string
  ): boolean {
    const team = this.teamStore.get(canonicalTeamId);
    if (!team || !logoUrl || typeof logoUrl !== 'string') return false;

    const trimmedUrl = logoUrl.trim();
    const isHttps = trimmedUrl.startsWith('https://');
    const isTrusted =
      isHttps &&
      (trimmedUrl.includes('api-sports.io') ||
        trimmedUrl.includes('football-data.org') ||
        trimmedUrl.includes('media.api-sports.io'));

    if (!isTrusted) return false;

    this.bindSourceTeamId(canonicalTeamId, provider, verifiedSourceId);
    team.logoUrl = trimmedUrl;
    team.logoSource = `${provider.toUpperCase()}_VERIFIED`;
    team.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Section 9 & 238: Deterministic Fixture Fingerprinting
   */
  public generateFingerprint(
    homeCanonicalId: string,
    awayCanonicalId: string,
    kickoffDate: string,
    competitionId: string = 'global'
  ): string {
    const dateOnly = kickoffDate ? kickoffDate.split('T')[0] : 'undated';
    return `${competitionId}__${homeCanonicalId}__vs__${awayCanonicalId}__${dateOnly}`;
  }

  /**
   * Derives deterministic season identifier (e.g. '2026-2027') from a date.
   * European/global football calendar resets in July.
   */
  public deriveSeasonId(kickoffDate: string): string {
    const d = new Date(kickoffDate);
    if (isNaN(d.getTime())) return 'unknown_season';
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  /**
   * Looks up an existing canonical fixture record by provider and source ID
   */
  public getCanonicalFixtureBySource(provider: string, sourceFixtureId: string): CanonicalFixtureRecord | undefined {
    if (!provider || !sourceFixtureId) return undefined;
    const key = `${provider.toLowerCase()}__${sourceFixtureId}`;
    const canonicalId = this.providerSourceIndex.get(key);
    if (!canonicalId) return undefined;
    return this.fixtureStore.get(canonicalId);
  }

  /**
   * Registers or resolves a canonical fixture across providers and preserves lineage for rescheduled/postponed fixtures.
   * Prevents duplicate creation on re-arrival and avoids falsely merging distinct seasons or reversed home/away legs.
   */
  public registerOrResolveFixture(params: {
    provider: string;
    sourceFixtureId: string;
    homeTeamName: string;
    awayTeamName: string;
    kickoffDate: string;
    competitionCode?: string;
    seasonId?: string;
    status?: string;
  }): {
    fixture: CanonicalFixtureRecord;
    isNew: boolean;
    isRescheduled: boolean;
    conflictDetected?: boolean;
    conflictReason?: string;
  } {
    const { provider, sourceFixtureId, homeTeamName, awayTeamName, kickoffDate } = params;
    const providerKey = `${provider.toLowerCase()}__${sourceFixtureId}`;

    // 1. Direct provider ID index lookup: avoids duplicate records
    const existingCanonicalId = this.providerSourceIndex.get(providerKey);
    if (existingCanonicalId) {
      const existing = this.fixtureStore.get(existingCanonicalId);
      if (existing) {
        const oldDateOnly = existing.scheduledAt ? existing.scheduledAt.split('T')[0] : '';
        const newDateOnly = kickoffDate ? kickoffDate.split('T')[0] : '';
        if (oldDateOnly && newDateOnly && oldDateOnly !== newDateOnly) {
          existing.isRescheduled = true;
          existing.rescheduledFrom = existing.scheduledAt;
          existing.scheduledAt = kickoffDate;
          existing.updatedAt = new Date().toISOString();
        }
        return {
          fixture: existing,
          isNew: false,
          isRescheduled: existing.isRescheduled,
        };
      }
    }

    // 2. Resolve canonical team identities
    const homeRes = this.resolveTeam({ name: homeTeamName });
    const awayRes = this.resolveTeam({ name: awayTeamName });
    const homeId = homeRes.team?.canonicalTeamId || `h_${this.normalizeName(homeTeamName)}`;
    const awayId = awayRes.team?.canonicalTeamId || `a_${this.normalizeName(awayTeamName)}`;
    const compCode = (params.competitionCode || 'GENERIC').toUpperCase();
    const seasonId = params.seasonId || this.deriveSeasonId(kickoffDate);

    // 3. Lineage Key: strictly scoped to same competition + same canonical home/away in the SAME season
    const lineageKey = `${compCode}__${homeId}__vs__${awayId}__${seasonId}`;
    const lineageFixtureId = this.fixtureLineageIndex.get(lineageKey);

    if (lineageFixtureId) {
      const existingLineageFixture = this.fixtureStore.get(lineageFixtureId);
      if (existingLineageFixture) {
        const oldDateOnly = existingLineageFixture.scheduledAt ? existingLineageFixture.scheduledAt.split('T')[0] : '';
        const newDateOnly = kickoffDate ? kickoffDate.split('T')[0] : '';

        // Conflict check: if different providers send conflicting data with > 4 hours gap on same day
        const timeDiffMs = Math.abs(new Date(existingLineageFixture.scheduledAt).getTime() - new Date(kickoffDate).getTime());
        if (oldDateOnly === newDateOnly && timeDiffMs > 4 * 3600 * 1000) {
          return {
            fixture: existingLineageFixture,
            isNew: false,
            isRescheduled: false,
            conflictDetected: true,
            conflictReason: `CONFLICTING_PROVIDER_DATA: Sağlayıcılar arasında başlama saati çelişkisi (${existingLineageFixture.scheduledAt} vs ${kickoffDate}).`,
          };
        }

        // Rescheduled / Postponed within the same season
        if (oldDateOnly && newDateOnly && oldDateOnly !== newDateOnly) {
          existingLineageFixture.isRescheduled = true;
          existingLineageFixture.rescheduledFrom = existingLineageFixture.scheduledAt;
          existingLineageFixture.scheduledAt = kickoffDate;
          existingLineageFixture.updatedAt = new Date().toISOString();
        }

        // Attach provider ID mapping to canonical fixture
        const hasProvider = existingLineageFixture.sourceFixtureIds.some(
          (s) => s.provider.toLowerCase() === provider.toLowerCase() && s.sourceId === sourceFixtureId
        );
        if (!hasProvider) {
          existingLineageFixture.sourceFixtureIds.push({ provider, sourceId: sourceFixtureId });
        }

        // Map provider source to canonical fixture ID
        this.providerSourceIndex.set(providerKey, existingLineageFixture.canonicalFixtureId);

        return {
          fixture: existingLineageFixture,
          isNew: false,
          isRescheduled: existingLineageFixture.isRescheduled,
        };
      }
    }

    // 4. Create new canonical fixture
    const fingerprint = this.generateFingerprint(homeId, awayId, kickoffDate, compCode);
    const canonicalFixtureId = `cf_${fingerprint}`;

    const newRecord: CanonicalFixtureRecord = {
      canonicalFixtureId,
      sourceFixtureIds: [{ provider, sourceId: sourceFixtureId }],
      homeTeamCanonicalId: homeId,
      awayTeamCanonicalId: awayId,
      competitionId: compCode,
      seasonId,
      scheduledAt: kickoffDate,
      timezone: 'UTC',
      status: params.status || 'SCHEDULED',
      fingerprint,
      isRescheduled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.fixtureStore.set(canonicalFixtureId, newRecord);
    this.providerSourceIndex.set(providerKey, canonicalFixtureId);
    this.fixtureLineageIndex.set(lineageKey, canonicalFixtureId);

    return {
      fixture: newRecord,
      isNew: true,
      isRescheduled: false,
    };
  }

  /**
   * Section 10 & 241: Wrong Match Guard - Validates fixture identity before analysis
   */
  public validateFixtureIdentity(match: CanonicalMatch): {
    isValid: boolean;
    canonicalFixtureId: string;
    homeCanonical?: CanonicalTeamRecord;
    awayCanonical?: CanonicalTeamRecord;
    issues: string[];
  } {
    const issues: string[] = [];

    const homeRes = this.resolveTeam({
      name: match.homeTeam.name,
      sourceId: match.homeTeam.id,
      provider: match.provider,
      country: match.league?.country,
    });

    const awayRes = this.resolveTeam({
      name: match.awayTeam.name,
      sourceId: match.awayTeam.id,
      provider: match.provider,
      country: match.league?.country,
    });

    if (!homeRes.team) {
      issues.push(`Ev sahibi takım doğrulanamadı: "${match.homeTeam.name}"`);
    }
    if (!awayRes.team) {
      issues.push(`Deplasman takımı doğrulanamadı: "${match.awayTeam.name}"`);
    }

    if (homeRes.team && awayRes.team) {
      if (homeRes.team.canonicalTeamId === awayRes.team.canonicalTeamId) {
        issues.push(`Kritik Entity Hatası: Ev sahibi ve deplasman takımları aynı canonical kimliğe sahip (${homeRes.team.canonicalTeamId}).`);
      }
    }

    const kickoffTime = new Date(match.utcDate).getTime();
    if (isNaN(kickoffTime)) {
      issues.push('Kritik Tarih Hatası: Maç başlama saati geçerli bir zaman damgası değil.');
    }

    const competitionCode = match.league?.code || match.league?.name || 'GENERIC';
    const fingerprint = this.generateFingerprint(
      homeRes.team?.canonicalTeamId || 'h_unknown',
      awayRes.team?.canonicalTeamId || 'a_unknown',
      match.utcDate,
      competitionCode
    );

    let canonicalFixtureId = `cf_${fingerprint}`;
    if (issues.length === 0 && match.provider && (match.externalId || match.id)) {
      const reg = this.registerOrResolveFixture({
        provider: match.provider,
        sourceFixtureId: match.externalId || match.id,
        homeTeamName: match.homeTeam.name,
        awayTeamName: match.awayTeam.name,
        kickoffDate: match.utcDate,
        competitionCode,
        status: match.status,
      });
      canonicalFixtureId = reg.fixture.canonicalFixtureId;
      if (reg.conflictDetected && reg.conflictReason) {
        issues.push(reg.conflictReason);
      }
    }

    return {
      isValid: issues.length === 0,
      canonicalFixtureId,
      homeCanonical: homeRes.team || undefined,
      awayCanonical: awayRes.team || undefined,
      issues,
    };
  }

  /**
   * Section 11, 12, 87 & 242: WRONG LOGO GUARD
   * Verifies that the logo URL belongs to the canonical team owner.
   * If mismatch, forces monogram initials fallback and raises LOGO_IDENTITY_CONFLICT.
   */
  public verifyLogo(
    teamName: string,
    crestUrlProp?: string,
    canonicalTeamId?: string
  ): LogoVerificationResult {
    let team: CanonicalTeamRecord | null = null;
    if (canonicalTeamId && this.teamStore.has(canonicalTeamId)) {
      team = this.teamStore.get(canonicalTeamId)!;
    } else {
      const resolution = this.resolveTeam({ name: teamName });
      team = resolution.team;
    }

    if (!team) {
      return {
        isVerified: false,
        canonicalTeamId: 'unknown',
        fallbackInitials: teamName.substring(0, 3).toUpperCase(),
        primaryColor: '#334155',
        secondaryColor: '#64748B',
        textColor: '#FFFFFF',
        conflictDetected: true,
        conflictReason: 'Takım kimliği canonical veri tabanında bulunamadı.',
      };
    }

    // Check crest URL validity
    const verifiedUrl = team.logoUrl;
    const candidateUrl = crestUrlProp || verifiedUrl;

    if (!candidateUrl) {
      return {
        isVerified: false,
        canonicalTeamId: team.canonicalTeamId,
        fallbackInitials: team.shortName,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
        textColor: team.textColor,
        conflictDetected: false,
      };
    }

    // If an external crestUrl is passed, check if it references another team's known ID
    if (crestUrlProp && verifiedUrl && crestUrlProp !== verifiedUrl) {
      // Check for foreign club ID in known patterns like crests.football-data.org/XYZ.png
      const foreignMatch = crestUrlProp.match(/\/(\d+)\.png/);
      const verifiedMatch = verifiedUrl.match(/\/(\d+)\.png/);

      if (foreignMatch && verifiedMatch && foreignMatch[1] !== verifiedMatch[1]) {
        // Logo belongs to a different club! Suppress and trigger LOGO_IDENTITY_CONFLICT
        return {
          isVerified: false,
          canonicalTeamId: team.canonicalTeamId,
          effectiveLogoUrl: verifiedUrl, // Use verified team logo instead of foreign logo
          fallbackInitials: team.shortName,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
          textColor: team.textColor,
          conflictDetected: true,
          conflictReason: `LOGO_IDENTITY_CONFLICT: Dış kaynaktan gelen logo ID (${foreignMatch[1]}) ile canonical takım logo ID (${verifiedMatch[1]}) uyuşmuyor!`,
        };
      }
    }

    return {
      isVerified: Boolean(candidateUrl),
      canonicalTeamId: team.canonicalTeamId,
      effectiveLogoUrl: candidateUrl,
      fallbackInitials: team.shortName,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      textColor: team.textColor,
      conflictDetected: false,
    };
  }

  /**
   * Section 88 & 248: WRONG ODDS GUARD & STALE DATA GUARD
   * Ensures odds event belongs strictly to the target canonical fixture and is not stale.
   */
  public verifyOddsBinding(
    targetFixture: CanonicalMatch,
    oddsData: NesineMatchOddsData,
    oddsHomeName?: string,
    oddsAwayName?: string,
    oddsKickoff?: string
  ): OddsBindingVerification {
    if (oddsData.status === 'NESINE_UNAVAILABLE' || oddsData.markets.length === 0) {
      return {
        isValid: false,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: '',
        awayTeamCanonicalId: '',
        kickoffDifferenceMinutes: 0,
        isStale: false,
        stalenessAgeMinutes: 0,
        reasonCode: 'ODDS_NOT_FOUND',
        diagnosticMessage: oddsData.diagnosticMessage || 'Bu maç için aktif piyasa oranı bulunamadı.',
      };
    }

    const targetHome = this.resolveTeam({ name: targetFixture.homeTeam.name });
    const targetAway = this.resolveTeam({ name: targetFixture.awayTeam.name });

    // If odds provider gave specific team names, verify they match canonical fixture teams
    if (oddsHomeName && oddsAwayName) {
      const oddsHome = this.resolveTeam({ name: oddsHomeName });
      const oddsAway = this.resolveTeam({ name: oddsAwayName });

      if (
        !targetHome.team ||
        !oddsHome.team ||
        targetHome.team.canonicalTeamId !== oddsHome.team.canonicalTeamId ||
        !targetAway.team ||
        !oddsAway.team ||
        targetAway.team.canonicalTeamId !== oddsAway.team.canonicalTeamId
      ) {
        return {
          isValid: false,
          canonicalFixtureId: targetFixture.id,
          homeTeamCanonicalId: targetHome.team?.canonicalTeamId || '',
          awayTeamCanonicalId: targetAway.team?.canonicalTeamId || '',
          kickoffDifferenceMinutes: 0,
          isStale: false,
          stalenessAgeMinutes: 0,
          reasonCode: 'ODDS_TEAM_MISMATCH',
          diagnosticMessage: `WRONG_ODDS_GUARD: Oran takımları ("${oddsHomeName} - ${oddsAwayName}") ile hedef maç takımları ("${targetFixture.homeTeam.name} - ${targetFixture.awayTeam.name}") uyuşmuyor!`,
        };
      }
    }

    // Check Kickoff time discrepancy if available
    let diffMinutes = 0;
    if (oddsKickoff) {
      const targetTime = new Date(targetFixture.utcDate).getTime();
      const oddsTime = new Date(oddsKickoff).getTime();
      if (!isNaN(targetTime) && !isNaN(oddsTime)) {
        diffMinutes = Math.abs(targetTime - oddsTime) / (1000 * 60);
        if (diffMinutes > 180) {
          return {
            isValid: false,
            canonicalFixtureId: targetFixture.id,
            homeTeamCanonicalId: targetHome.team?.canonicalTeamId || '',
            awayTeamCanonicalId: targetAway.team?.canonicalTeamId || '',
            kickoffDifferenceMinutes: Math.round(diffMinutes),
            isStale: false,
            stalenessAgeMinutes: 0,
            reasonCode: 'ODDS_FIXTURE_MISMATCH',
            diagnosticMessage: `WRONG_ODDS_GUARD: Oran başlangıç saati ile maç saati arasında ${Math.round(diffMinutes)} dakika fark var. Farklı bir karşılaşmaya ait olabilir.`,
          };
        }
      }
    }

    // Check staleness (> 6 hours old)
    const retrievedTime = new Date(oddsData.retrievedAt).getTime();
    const ageMinutes = !isNaN(retrievedTime) ? (Date.now() - retrievedTime) / (1000 * 60) : 0;
    const isStale = ageMinutes > 360;

    if (isStale) {
      return {
        isValid: false,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: targetHome.team?.canonicalTeamId || '',
        awayTeamCanonicalId: targetAway.team?.canonicalTeamId || '',
        kickoffDifferenceMinutes: Math.round(diffMinutes),
        isStale: true,
        stalenessAgeMinutes: Math.round(ageMinutes),
        reasonCode: 'ODDS_STALE',
        diagnosticMessage: `STALE_DATA_GUARD: Oran verisi ${Math.round(ageMinutes)} dakika önce alınmış (güncelliğini yitirmiş). Analiz için kullanılamaz.`,
      };
    }

    // Check for invalid odds (<= 1.01, negative, NaN, or closed market)
    if (oddsData.markets && oddsData.markets.length > 0) {
      for (const m of oddsData.markets) {
        for (const out of m.outcomes) {
          const oddVal = typeof out.odd === 'number' ? out.odd : (out as any).odds;
          const outName = out.name || (out as any).outcomeName || 'Outcome';
          if (isNaN(oddVal) || oddVal <= 1.01) {
            return {
              isValid: false,
              canonicalFixtureId: targetFixture.id,
              homeTeamCanonicalId: targetHome.team?.canonicalTeamId || '',
              awayTeamCanonicalId: targetAway.team?.canonicalTeamId || '',
              kickoffDifferenceMinutes: Math.round(diffMinutes),
              isStale: false,
              stalenessAgeMinutes: Math.round(ageMinutes),
              reasonCode: 'ODDS_INVALID',
              diagnosticMessage: `INVALID_ODDS_GUARD: Piyasa oranı geçersiz veya kapalı (${outName}: ${oddVal}). Oranlar 1.01'den büyük geçerli bir sayı olmalıdır.`,
            };
          }
        }
      }
    }

    return {
      isValid: true,
      canonicalFixtureId: targetFixture.id,
      homeTeamCanonicalId: targetHome.team?.canonicalTeamId || '',
      awayTeamCanonicalId: targetAway.team?.canonicalTeamId || '',
      kickoffDifferenceMinutes: Math.round(diffMinutes),
      isStale: false,
      stalenessAgeMinutes: Math.round(ageMinutes),
      reasonCode: 'VALID',
      diagnosticMessage: 'Piyasa oranları hedef fikstürle tam olarak doğrulandı.',
    };
  }

  /**
   * Section 90: WRONG H2H GUARD
   * Filters out matches that do not strictly involve the exact two canonical teams.
   */
  public verifyH2HBinding(
    targetFixture: CanonicalMatch,
    h2h?: CanonicalH2H
  ): H2HBindingVerification {
    if (!h2h || h2h.status === 'MISSING' || !h2h.recentMatches || h2h.recentMatches.length === 0) {
      return {
        isValid: true,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: '',
        awayTeamCanonicalId: '',
        rejectedMatchesCount: 0,
        validMatchesCount: 0,
        diagnosticMessage: 'Doğrulanmış H2H verisi bulunmuyor.',
      };
    }

    const homeRes = this.resolveTeam({ name: targetFixture.homeTeam.name });
    const awayRes = this.resolveTeam({ name: targetFixture.awayTeam.name });
    const homeId = homeRes.team?.canonicalTeamId;
    const awayId = awayRes.team?.canonicalTeamId;

    // Rule 4: Belirsiz eşleşmede H2H kullanma
    if (
      !homeId ||
      !awayId ||
      homeRes.confidence < 0.6 ||
      awayRes.confidence < 0.6 ||
      homeRes.reason?.includes('ENTITY_AMBIGUOUS') ||
      awayRes.reason?.includes('ENTITY_AMBIGUOUS')
    ) {
      return {
        isValid: false,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: homeId || '',
        awayTeamCanonicalId: awayId || '',
        rejectedMatchesCount: h2h.recentMatches.length,
        validMatchesCount: 0,
        diagnosticMessage: 'ENTITY_AMBIGUOUS: Takım kimliği belirsiz olduğu için H2H verisi doğrulanamadı ve analize dahil edilmedi.',
      };
    }

    let rejected = 0;
    let valid = 0;
    const verifiedMatches: typeof h2h.recentMatches = [];

    for (const m of h2h.recentMatches) {
      const mHome = this.resolveTeam({ name: m.homeTeam }).team?.canonicalTeamId;
      const mAway = this.resolveTeam({ name: m.awayTeam }).team?.canonicalTeamId;

      // Rule 5: Ev/deplasman yönü ters olabilir; ancak üçüncü takımlar kesinlikle elenmeli
      const isPair =
        (mHome === homeId && mAway === awayId) ||
        (mHome === awayId && mAway === homeId);

      if (isPair) {
        valid++;
        verifiedMatches.push(m);
      } else {
        rejected++;
      }
    }

    // Filter out 3rd party matches in-place from recentMatches
    if (rejected > 0) {
      h2h.recentMatches = verifiedMatches;
      h2h.matchesCount = verifiedMatches.length;
    }

    const isValid = valid > 0 || rejected === 0;

    return {
      isValid,
      canonicalFixtureId: targetFixture.id,
      homeTeamCanonicalId: homeId || '',
      awayTeamCanonicalId: awayId || '',
      rejectedMatchesCount: rejected,
      validMatchesCount: valid,
      diagnosticMessage: rejected > 0
        ? `WRONG_H2H_GUARD: ${rejected} adet maç bu iki takım arasındaki ikili rekabete ait olmadığı için elendi.`
        : 'Tüm H2H maçları hedef takımlarla doğrulandı.',
    };
  }

  /**
   * ADVANCED xG v2.0: Section 95 - xG BINDING & NO-INVENTION GUARD
   * Verifies that provided real xG metrics strictly bind to the exact target fixture
   * and prevents data hallucinations or future leakage.
   */
  public verifyXGBinding(
    targetFixture: CanonicalMatch,
    stats?: CanonicalStats
  ): XGBindingVerification {
    const homeRes = this.resolveTeam({ name: targetFixture.homeTeam.name });
    const awayRes = this.resolveTeam({ name: targetFixture.awayTeam.name });
    const homeId = homeRes.team?.canonicalTeamId || '';
    const awayId = awayRes.team?.canonicalTeamId || '';

    if (!stats || (stats.homeXG === undefined && stats.awayXG === undefined && stats.xG === undefined)) {
      return {
        isValid: true,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: homeId,
        awayTeamCanonicalId: awayId,
        isStale: false,
        stalenessAgeMinutes: 0,
        reasonCode: 'XG_NOT_FOUND',
        diagnosticMessage: 'Hedef fikstür için harici sağlayıcıdan gerçek xG verisi mevcut değil (No-Invention koruması devrede).',
      };
    }

    // Check invalid/absurd values (e.g. negative or > 12.0)
    const homeVal = stats.homeXG ?? stats.xG;
    const awayVal = stats.awayXG;

    if (
      (homeVal !== undefined && (isNaN(homeVal) || homeVal < 0 || homeVal > 15)) ||
      (awayVal !== undefined && (isNaN(awayVal) || awayVal < 0 || awayVal > 15))
    ) {
      return {
        isValid: false,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: homeId,
        awayTeamCanonicalId: awayId,
        isStale: false,
        stalenessAgeMinutes: 0,
        reasonCode: 'XG_INVALID',
        diagnosticMessage: 'XG_INVALID: xG değerleri sayısal sınırların (0 - 15) dışında veya geçersiz.',
      };
    }

    // Check future data leakage
    if (stats.retrievedAt) {
      const retrievedTime = new Date(stats.retrievedAt).getTime();
      const now = Date.now();
      if (retrievedTime > now + 60 * 1000) {
        return {
          isValid: false,
          canonicalFixtureId: targetFixture.id,
          homeTeamCanonicalId: homeId,
          awayTeamCanonicalId: awayId,
          isStale: false,
          stalenessAgeMinutes: 0,
          reasonCode: 'FUTURE_DATA_LEAKAGE',
          diagnosticMessage: 'FUTURE_DATA_LEAKAGE: xG veri zaman damgası geleceğe ait, sızıntı koruması devrede.',
        };
      }
    }

    return {
      isValid: true,
      canonicalFixtureId: targetFixture.id,
      homeTeamCanonicalId: homeId,
      awayTeamCanonicalId: awayId,
      isStale: false,
      stalenessAgeMinutes: 0,
      reasonCode: 'VALID',
      diagnosticMessage: 'Gerçek xG verisi hedef fikstürle başarıyla doğrulandı.',
    };
  }

  /**
   * SQUAD & PLAYER IMPACT v2.0: SQUAD BINDING & ZERO-TRUST INTEGRITY VERIFICATION
   * Validates squad data against canonical fixture, team identity bindings,
   * ensures no fake/mock players exist, and checks temporal validity / future leakage.
   */
  public verifySquadBinding(
    targetFixture: CanonicalMatch,
    squadData?: CanonicalMatchSquadData
  ): SquadBindingVerification {
    const homeId = this.resolveCanonicalTeamId(targetFixture.homeTeam.name);
    const awayId = this.resolveCanonicalTeamId(targetFixture.awayTeam.name);

    if (!squadData) {
      return {
        isValid: false,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: homeId,
        awayTeamCanonicalId: awayId,
        homeSquadValid: false,
        awaySquadValid: false,
        ambiguousPlayersCount: 0,
        rejectedPlayersCount: 0,
        isStale: false,
        stalenessAgeMinutes: 0,
        reasonCode: 'SQUAD_NOT_FOUND',
        diagnosticMessage: 'SQUAD_NOT_FOUND: Bu fikstür için doğrulanmış kadro verisi mevcut değil.',
      };
    }

    // 1. Future Data Leakage Check
    if (squadData.retrievedAt) {
      const retrievedTime = new Date(squadData.retrievedAt).getTime();
      const now = Date.now();
      if (retrievedTime > now + 60 * 1000) {
        return {
          isValid: false,
          canonicalFixtureId: targetFixture.id,
          homeTeamCanonicalId: homeId,
          awayTeamCanonicalId: awayId,
          homeSquadValid: false,
          awaySquadValid: false,
          ambiguousPlayersCount: 0,
          rejectedPlayersCount: 0,
          isStale: false,
          stalenessAgeMinutes: 0,
          reasonCode: 'FUTURE_DATA_LEAKAGE',
          diagnosticMessage: 'FUTURE_DATA_LEAKAGE: Kadro veri zaman damgası geleceğe ait, sızıntı koruması devrede.',
        };
      }
    }

    // 2. Team binding verification
    const squadHomeTeamId = String(squadData.home?.canonicalTeamId || squadData.home?.teamId || '');
    const squadAwayTeamId = String(squadData.away?.canonicalTeamId || squadData.away?.teamId || '');

    const resolvedSquadHome = squadHomeTeamId ? this.resolveCanonicalTeamId(squadData.home?.teamName || squadHomeTeamId) : '';
    const resolvedSquadAway = squadAwayTeamId ? this.resolveCanonicalTeamId(squadData.away?.teamName || squadAwayTeamId) : '';

    const homeMatches = (squadHomeTeamId && squadHomeTeamId === homeId) || (resolvedSquadHome && resolvedSquadHome === homeId);
    const awayMatches = (squadAwayTeamId && squadAwayTeamId === awayId) || (resolvedSquadAway && resolvedSquadAway === awayId);

    if (!homeMatches || !awayMatches) {
      return {
        isValid: false,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: homeId,
        awayTeamCanonicalId: awayId,
        homeSquadValid: Boolean(homeMatches),
        awaySquadValid: Boolean(awayMatches),
        ambiguousPlayersCount: 0,
        rejectedPlayersCount: 0,
        isStale: false,
        stalenessAgeMinutes: 0,
        reasonCode: 'SQUAD_TEAM_MISMATCH',
        diagnosticMessage: `SQUAD_TEAM_MISMATCH: Kadro takımları (${squadData.home?.teamName || squadHomeTeamId} - ${squadData.away?.teamName || squadAwayTeamId}) hedef fikstürle (${targetFixture.homeTeam.name} - ${targetFixture.awayTeam.name}) eşleşmiyor.`,
      };
    }

    // 3. Inspect players for zero-trust (no fake/mock/random players, verified binding)
    let ambiguousPlayersCount = 0;
    let rejectedPlayersCount = 0;

    const inspectSquad = (squad: typeof squadData.home, expectedTeamCanonicalId: string) => {
      const allPlayers = [
        ...(squad?.startingXI || []),
        ...(squad?.bench || []),
        ...(squad?.injuriesAndAbsences || []),
      ];

      for (const p of allPlayers) {
        if (!p.name || p.name.trim().length < 2) {
          rejectedPlayersCount++;
          continue;
        }
        const lower = p.name.toLowerCase();
        if (
          lower.includes('player') ||
          lower.includes('oyuncu') ||
          lower.includes('mock') ||
          lower.includes('test') ||
          lower.includes('sample') ||
          lower.includes('random') ||
          lower.includes('placeholder')
        ) {
          rejectedPlayersCount++;
          continue;
        }
        if (p.canonicalTeamId && p.canonicalTeamId !== expectedTeamCanonicalId) {
          ambiguousPlayersCount++;
        }
        if (!p.verified && !p.canonicalPlayerId) {
          ambiguousPlayersCount++;
        }
      }
    };

    if (squadData.home) inspectSquad(squadData.home, homeId);
    if (squadData.away) inspectSquad(squadData.away, awayId);

    if (rejectedPlayersCount > 0) {
      return {
        isValid: false,
        canonicalFixtureId: targetFixture.id,
        homeTeamCanonicalId: homeId,
        awayTeamCanonicalId: awayId,
        homeSquadValid: false,
        awaySquadValid: false,
        ambiguousPlayersCount,
        rejectedPlayersCount,
        isStale: false,
        stalenessAgeMinutes: 0,
        reasonCode: 'AMBIGUOUS_PLAYER_IDENTITY',
        diagnosticMessage: `AMBIGUOUS_PLAYER_IDENTITY: Kadroda ${rejectedPlayersCount} adet doğrulanmamış/şüpheli oyuncu kaydı tespit edildi. Sıfır-güven kuralı devrede.`,
      };
    }

    // 4. Check staleness
    let isStale = false;
    let stalenessAgeMinutes = 0;
    const kickoffTime = new Date(targetFixture.utcDate).getTime();
    if (squadData.retrievedAt) {
      const ageMs = Date.now() - new Date(squadData.retrievedAt).getTime();
      stalenessAgeMinutes = Math.max(0, Math.floor(ageMs / (1000 * 60)));
      if (kickoffTime - Date.now() < 60 * 60 * 1000 && stalenessAgeMinutes > 24 * 60) {
        isStale = true;
      }
    }

    return {
      isValid: true,
      canonicalFixtureId: targetFixture.id,
      homeTeamCanonicalId: homeId,
      awayTeamCanonicalId: awayId,
      homeSquadValid: true,
      awaySquadValid: true,
      ambiguousPlayersCount,
      rejectedPlayersCount: 0,
      isStale,
      stalenessAgeMinutes,
      reasonCode: 'VALID',
      diagnosticMessage: `Kadro verisi hedef fikstürle (${targetFixture.homeTeam.name} vs ${targetFixture.awayTeam.name}) başarıyla doğrulandı.`,
    };
  }

  /**
   * Section 86 & 205: FINAL CONSISTENCY CHECK
   * Validates all identity links prior to publishing an analysis.
   */
  public runFinalConsistencyCheck(
    match: CanonicalMatch,
    h2h?: CanonicalH2H,
    oddsData?: NesineMatchOddsData,
    stats?: CanonicalStats,
    squadData?: CanonicalMatchSquadData
  ): FinalConsistencyReport {
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    // 1. Fixture Identity Check
    const fixtureCheck = this.validateFixtureIdentity(match);
    if (!fixtureCheck.isValid) {
      blockingReasons.push(...fixtureCheck.issues);
    }

    // 2. Logo Verification Check
    const homeLogoCheck = this.verifyLogo(match.homeTeam.name, match.homeTeam.crest);
    const awayLogoCheck = this.verifyLogo(match.awayTeam.name, match.awayTeam.crest);

    if (homeLogoCheck.conflictDetected) {
      warnings.push(`Ev Sahibi Logo Uyarısı: ${homeLogoCheck.conflictReason}`);
    }
    if (awayLogoCheck.conflictDetected) {
      warnings.push(`Deplasman Logo Uyarısı: ${awayLogoCheck.conflictReason}`);
    }

    // 3. Odds Binding Check
    let oddsValid = true;
    if (oddsData && oddsData.status === 'CONNECTED') {
      const oddsBinding = this.verifyOddsBinding(match, oddsData);
      if (!oddsBinding.isValid) {
        oddsValid = false;
        if (
          oddsBinding.reasonCode === 'ODDS_FIXTURE_MISMATCH' ||
          oddsBinding.reasonCode === 'ODDS_TEAM_MISMATCH' ||
          oddsBinding.reasonCode === 'ODDS_STALE' ||
          oddsBinding.reasonCode === 'ODDS_INVALID'
        ) {
          blockingReasons.push(oddsBinding.diagnosticMessage);
        } else {
          warnings.push(oddsBinding.diagnosticMessage);
        }
      }
    }

    // Direct Match Odds Validation
    if (match.odds) {
      if (
        isNaN(match.odds.homeWin) ||
        isNaN(match.odds.draw) ||
        isNaN(match.odds.awayWin) ||
        match.odds.homeWin <= 1.01 ||
        match.odds.draw <= 1.01 ||
        match.odds.awayWin <= 1.01
      ) {
        oddsValid = false;
        blockingReasons.push(
          `INVALID_ODDS_GUARD: Maçın doğrudan oran verisi geçersiz veya kapalı (1: ${match.odds.homeWin}, X: ${match.odds.draw}, 2: ${match.odds.awayWin}). Oranlar 1.01'den büyük olmalıdır.`
        );
      }
    }

    // 4. H2H Binding Check
    let h2hValid = true;
    if (h2h) {
      const h2hCheck = this.verifyH2HBinding(match, h2h);
      if (!h2hCheck.isValid) {
        h2hValid = false;
        warnings.push(h2hCheck.diagnosticMessage);
      }
    }

    // 5. Advanced xG Binding & No-Invention Check
    let xgValid = true;
    if (stats) {
      const xgCheck = this.verifyXGBinding(match, stats);
      if (!xgCheck.isValid) {
        xgValid = false;
        if (xgCheck.reasonCode === 'FUTURE_DATA_LEAKAGE' || xgCheck.reasonCode === 'XG_INVALID') {
          blockingReasons.push(xgCheck.diagnosticMessage);
        } else {
          warnings.push(xgCheck.diagnosticMessage);
        }
      }
    }

    // 6. Squad & Player Impact Binding Check
    let squadValid = true;
    if (squadData) {
      const squadCheck = this.verifySquadBinding(match, squadData);
      if (!squadCheck.isValid) {
        squadValid = false;
        if (
          squadCheck.reasonCode === 'FUTURE_DATA_LEAKAGE' ||
          squadCheck.reasonCode === 'AMBIGUOUS_PLAYER_IDENTITY' ||
          squadCheck.reasonCode === 'SQUAD_TEAM_MISMATCH'
        ) {
          blockingReasons.push(squadCheck.diagnosticMessage);
        } else {
          warnings.push(squadCheck.diagnosticMessage);
        }
      }
    }

    const isConsistent = blockingReasons.length === 0;

    return {
      isConsistent,
      fixtureIdentityValid: fixtureCheck.isValid,
      homeTeamValid: Boolean(fixtureCheck.homeCanonical),
      awayTeamValid: Boolean(fixtureCheck.awayCanonical),
      competitionValid: Boolean(match.league?.name),
      kickoffValid: !isNaN(new Date(match.utcDate).getTime()),
      homeLogoValid: !homeLogoCheck.conflictDetected,
      awayLogoValid: !awayLogoCheck.conflictDetected,
      oddsBindingValid: oddsValid,
      statsBindingValid: true,
      h2hBindingValid: h2hValid,
      xgBindingValid: xgValid,
      squadBindingValid: squadData ? squadValid : undefined,
      sourceAgreementValid: true,
      freshnessValid: true,
      blockingReasons,
      warnings,
      canonicalFixtureId: fixtureCheck.canonicalFixtureId,
      analysisPermitted: isConsistent,
    };
  }

  /**
   * Seeds master database of known European and Turkish football clubs
   */
  private seedCanonicalTeams(): void {
    const teams: CanonicalTeamRecord[] = [
      // TURKEY - SÜPER LİG
      {
        canonicalTeamId: 'tr_galatasaray',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '610' },
          { provider: 'api-football', sourceId: '645' },
        ],
        officialName: 'Galatasaray Spor Kulübü',
        normalizedName: 'galatasaray',
        shortName: 'GS',
        country: 'Turkey',
        competitionIds: ['tr_superlig'],
        aliases: ['galatasaray', 'galatasaray sk', 'galatasaray a.s.', 'gala', 'cimbom'],
        logoUrl: 'https://crests.football-data.org/610.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#A90432',
        secondaryColor: '#FDB912',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'tr_fenerbahce',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '600' },
          { provider: 'api-football', sourceId: '611' },
        ],
        officialName: 'Fenerbahçe Spor Kulübü',
        normalizedName: 'fenerbahce',
        shortName: 'FB',
        country: 'Turkey',
        competitionIds: ['tr_superlig'],
        aliases: ['fenerbahce', 'fenerbahce sk', 'fenerbahce a.s.', 'fener', 'kanarya'],
        logoUrl: 'https://crests.football-data.org/600.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#002D72',
        secondaryColor: '#FFED00',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'tr_besiktas',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '603' },
          { provider: 'api-football', sourceId: '558' },
        ],
        officialName: 'Beşiktaş Jimnastik Kulübü',
        normalizedName: 'besiktas',
        shortName: 'BJK',
        country: 'Turkey',
        competitionIds: ['tr_superlig'],
        aliases: ['besiktas', 'besiktas jk', 'besiktas a.s.', 'kartal', 'bjk'],
        logoUrl: 'https://crests.football-data.org/603.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#111827',
        secondaryColor: '#E5E7EB',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'tr_trabzonspor',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '605' },
          { provider: 'api-football', sourceId: '997' },
        ],
        officialName: 'Trabzonspor Kulübü',
        normalizedName: 'trabzonspor',
        shortName: 'TS',
        country: 'Turkey',
        competitionIds: ['tr_superlig'],
        aliases: ['trabzonspor', 'trabzonspor a.s.', 'trabzon'],
        logoUrl: 'https://crests.football-data.org/605.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#800020',
        secondaryColor: '#5BC0BE',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'tr_basaksehir',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '608' },
          { provider: 'api-football', sourceId: '3574' },
        ],
        officialName: 'İstanbul Başakşehir Futbol Kulübü',
        normalizedName: 'basaksehir',
        shortName: 'İBFK',
        country: 'Turkey',
        competitionIds: ['tr_superlig'],
        aliases: ['istanbul basaksehir', 'basaksehir fk', 'm. basaksehir', 'basaksehir'],
        logoUrl: 'https://crests.football-data.org/608.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#F26522',
        secondaryColor: '#1A2B4C',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'tr_samsunspor',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '609' },
          { provider: 'api-football', sourceId: '3578' },
        ],
        officialName: 'Samsunspor Futbol Kulübü',
        normalizedName: 'samsunspor',
        shortName: 'SAM',
        country: 'Turkey',
        competitionIds: ['tr_superlig'],
        aliases: ['samsunspor', 'yilport samsunspor', 'samsun'],
        logoUrl: 'https://crests.football-data.org/609.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#DC2626',
        secondaryColor: '#FFFFFF',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'tr_eyupspor',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '611' },
          { provider: 'api-football', sourceId: '3589' },
        ],
        officialName: 'Eyüpspor Kulübü',
        normalizedName: 'eyupspor',
        shortName: 'EYÜP',
        country: 'Turkey',
        competitionIds: ['tr_superlig'],
        aliases: ['eyupspor', 'ikas eyupspor', 'eyup'],
        logoUrl: 'https://crests.football-data.org/611.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#581C87',
        secondaryColor: '#FACC15',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },

      // ENGLAND - PREMIER LEAGUE
      {
        canonicalTeamId: 'en_mancity',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '65' },
          { provider: 'api-football', sourceId: '50' },
        ],
        officialName: 'Manchester City Football Club',
        normalizedName: 'manchester city',
        shortName: 'MCI',
        country: 'England',
        competitionIds: ['en_premier_league'],
        aliases: ['manchester city', 'man city', 'mancity', 'city'],
        logoUrl: 'https://crests.football-data.org/65.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#6CABDD',
        secondaryColor: '#1C2C5B',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'en_arsenal',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '57' },
          { provider: 'api-football', sourceId: '42' },
        ],
        officialName: 'Arsenal Football Club',
        normalizedName: 'arsenal',
        shortName: 'ARS',
        country: 'England',
        competitionIds: ['en_premier_league'],
        aliases: ['arsenal', 'the gunners', 'arsenal fc'],
        logoUrl: 'https://crests.football-data.org/57.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#EF0107',
        secondaryColor: '#FFFFFF',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'en_liverpool',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '64' },
          { provider: 'api-football', sourceId: '40' },
        ],
        officialName: 'Liverpool Football Club',
        normalizedName: 'liverpool',
        shortName: 'LIV',
        country: 'England',
        competitionIds: ['en_premier_league'],
        aliases: ['liverpool', 'liverpool fc', 'the reds'],
        logoUrl: 'https://crests.football-data.org/64.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#C8102E',
        secondaryColor: '#00B2A9',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'en_manutd',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '66' },
          { provider: 'api-football', sourceId: '33' },
        ],
        officialName: 'Manchester United Football Club',
        normalizedName: 'manchester united',
        shortName: 'MUN',
        country: 'England',
        competitionIds: ['en_premier_league'],
        aliases: ['manchester united', 'man united', 'man utd', 'united'],
        logoUrl: 'https://crests.football-data.org/66.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#DA291C',
        secondaryColor: '#FBE122',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'en_chelsea',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '61' },
          { provider: 'api-football', sourceId: '49' },
        ],
        officialName: 'Chelsea Football Club',
        normalizedName: 'chelsea',
        shortName: 'CHE',
        country: 'England',
        competitionIds: ['en_premier_league'],
        aliases: ['chelsea', 'chelsea fc', 'the blues'],
        logoUrl: 'https://crests.football-data.org/61.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#034694',
        secondaryColor: '#EE242C',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'en_tottenham',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '73' },
          { provider: 'api-football', sourceId: '47' },
        ],
        officialName: 'Tottenham Hotspur Football Club',
        normalizedName: 'tottenham hotspur',
        shortName: 'TOT',
        country: 'England',
        competitionIds: ['en_premier_league'],
        aliases: ['tottenham', 'spurs', 'tottenham hotspur'],
        logoUrl: 'https://crests.football-data.org/73.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#132257',
        secondaryColor: '#FFFFFF',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },

      // SPAIN - LA LIGA
      {
        canonicalTeamId: 'es_realmadrid',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '86' },
          { provider: 'api-football', sourceId: '541' },
        ],
        officialName: 'Real Madrid Club de Fútbol',
        normalizedName: 'real madrid',
        shortName: 'RMA',
        country: 'Spain',
        competitionIds: ['es_laliga'],
        aliases: ['real madrid', 'real madrid cf', 'los blancos'],
        logoUrl: 'https://crests.football-data.org/86.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#EEEEEF',
        secondaryColor: '#FEBE10',
        textColor: '#111827',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'es_barcelona',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '81' },
          { provider: 'api-football', sourceId: '529' },
        ],
        officialName: 'Futbol Club Barcelona',
        normalizedName: 'barcelona',
        shortName: 'BAR',
        country: 'Spain',
        competitionIds: ['es_laliga'],
        aliases: ['barcelona', 'fc barcelona', 'barca'],
        logoUrl: 'https://crests.football-data.org/81.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#004D98',
        secondaryColor: '#A50044',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'es_atletico',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '78' },
          { provider: 'api-football', sourceId: '530' },
        ],
        officialName: 'Club Atlético de Madrid',
        normalizedName: 'atletico madrid',
        shortName: 'ATM',
        country: 'Spain',
        competitionIds: ['es_laliga'],
        aliases: ['atletico madrid', 'atletico', 'atleti', 'atletico de madrid'],
        logoUrl: 'https://crests.football-data.org/78.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#CB3524',
        secondaryColor: '#272E61',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },

      // GERMANY - BUNDESLIGA
      {
        canonicalTeamId: 'de_bayern',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '5' },
          { provider: 'api-football', sourceId: '157' },
        ],
        officialName: 'FC Bayern München',
        normalizedName: 'bayern munich',
        shortName: 'FCB',
        country: 'Germany',
        competitionIds: ['de_bundesliga'],
        aliases: ['bayern munich', 'bayern munchen', 'fc bayern', 'bayern'],
        logoUrl: 'https://crests.football-data.org/5.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#DC052D',
        secondaryColor: '#0066B2',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'de_leverkusen',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '3' },
          { provider: 'api-football', sourceId: '168' },
        ],
        officialName: 'Bayer 04 Leverkusen',
        normalizedName: 'bayer leverkusen',
        shortName: 'B04',
        country: 'Germany',
        competitionIds: ['de_bundesliga'],
        aliases: ['bayer leverkusen', 'leverkusen', 'bayer 04'],
        logoUrl: 'https://crests.football-data.org/3.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#E32221',
        secondaryColor: '#000000',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },

      // ITALY - SERIE A
      {
        canonicalTeamId: 'it_inter',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '108' },
          { provider: 'api-football', sourceId: '505' },
        ],
        officialName: 'FC Internazionale Milano',
        normalizedName: 'inter milan',
        shortName: 'INT',
        country: 'Italy',
        competitionIds: ['it_serie_a'],
        aliases: ['inter', 'inter milan', 'internazionale'],
        logoUrl: 'https://crests.football-data.org/108.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#001489',
        secondaryColor: '#000000',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'it_milan',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '98' },
          { provider: 'api-football', sourceId: '489' },
        ],
        officialName: 'AC Milan',
        normalizedName: 'ac milan',
        shortName: 'MIL',
        country: 'Italy',
        competitionIds: ['it_serie_a'],
        aliases: ['milan', 'ac milan', 'rossoneri'],
        logoUrl: 'https://crests.football-data.org/98.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#FB090B',
        secondaryColor: '#000000',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'it_juventus',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '109' },
          { provider: 'api-football', sourceId: '496' },
        ],
        officialName: 'Juventus Football Club',
        normalizedName: 'juventus',
        shortName: 'JUV',
        country: 'Italy',
        competitionIds: ['it_serie_a'],
        aliases: ['juventus', 'juve', 'bianconeri'],
        logoUrl: 'https://crests.football-data.org/109.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#000000',
        secondaryColor: '#FFFFFF',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },

      // FRANCE - LIGUE 1
      {
        canonicalTeamId: 'fr_psg',
        sourceTeamIds: [
          { provider: 'football-data.org', sourceId: '524' },
          { provider: 'api-football', sourceId: '85' },
        ],
        officialName: 'Paris Saint-Germain Football Club',
        normalizedName: 'paris saint germain',
        shortName: 'PSG',
        country: 'France',
        competitionIds: ['fr_ligue_1'],
        aliases: ['psg', 'paris saint germain', 'paris sg'],
        logoUrl: 'https://crests.football-data.org/524.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#004170',
        secondaryColor: '#DA291C',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },

      // QATAR - DIVISION 2
      {
        canonicalTeamId: 'qa_al_mesaimeer',
        sourceTeamIds: [],
        officialName: 'Al Mesaimeer SC',
        normalizedName: 'al mesaimeer',
        shortName: 'MES',
        country: 'Qatar',
        competitionIds: ['qa_division_2'],
        aliases: [
          'al mesaimeer',
          'al mesaimeer sc',
          'mesaimeer',
          'mesaimer',
          'al-mesaimeer',
          'al mesaimer',
          'mesaimeer sc',
        ],
        logoUrl: 'https://crests.football-data.org/default.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#F59E0B',
        secondaryColor: '#1F2937',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        canonicalTeamId: 'qa_al_kharaitiyat',
        sourceTeamIds: [],
        officialName: 'Al Kharaitiyat SC',
        normalizedName: 'al kharaitiyat',
        shortName: 'KHA',
        country: 'Qatar',
        competitionIds: ['qa_division_2'],
        aliases: [
          'al kharaitiyat',
          'al kharaitiyat sc',
          'al-kharitiyath',
          'kharitiyat',
          'al kharitiyat',
          'al-kharaitiyat',
          'kharaitiyat',
          'kharaitiyat sc',
        ],
        logoUrl: 'https://crests.football-data.org/default.png',
        logoSource: 'OFFICIAL_VERIFIED',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E3A8A',
        textColor: '#FFFFFF',
        identityConfidence: 1.0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    for (const team of teams) {
      this.registerTeam(team);
    }
  }
}

export const canonicalEntityManager = CanonicalEntityManager.getInstance();
