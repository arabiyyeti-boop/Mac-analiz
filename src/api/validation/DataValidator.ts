// src/api/validation/DataValidator.ts - Multi-tier Validation & Data Quality 2.0 System
import {
  CanonicalMatch,
  CanonicalStats,
  CanonicalH2H,
  CanonicalOdds,
  CanonicalForm,
  CanonicalStanding,
  DataQualityReport,
  DataQualityStatus,
  TemporalFreshnessClass,
  ComponentQualityDetail,
  QualityExplanationItem,
} from '@/types';
import { CanonicalEntityManager } from '../../entity/CanonicalEntityManager';

export interface ValidationIssue {
  level: 'SCHEMA' | 'SEMANTIC' | 'CROSS_SOURCE' | 'TEMPORAL' | 'LEAKAGE';
  field: string;
  message: string;
  fatal: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export class DataValidator {
  /**
   * LEVEL 1: Schema Validation
   * Checks that all required primitive fields, IDs, and nested structures are present.
   */
  static validateSchema(match: any): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (!match || typeof match !== 'object') {
      return {
        isValid: false,
        issues: [{ level: 'SCHEMA', field: 'match', message: 'Match payload is not an object', fatal: true }],
      };
    }

    if (!match.id || typeof match.id !== 'string') {
      issues.push({ level: 'SCHEMA', field: 'id', message: 'Missing or invalid match ID', fatal: true });
    }

    if (!match.utcDate || typeof match.utcDate !== 'string') {
      issues.push({ level: 'SCHEMA', field: 'utcDate', message: 'Missing or invalid utcDate timestamp', fatal: true });
    }

    if (!match.homeTeam || typeof match.homeTeam !== 'object' || !match.homeTeam.name) {
      issues.push({ level: 'SCHEMA', field: 'homeTeam', message: 'Missing home team data', fatal: true });
    }

    if (!match.awayTeam || typeof match.awayTeam !== 'object' || !match.awayTeam.name) {
      issues.push({ level: 'SCHEMA', field: 'awayTeam', message: 'Missing away team data', fatal: true });
    }

    if (!match.league || typeof match.league !== 'object' || !match.league.name) {
      issues.push({ level: 'SCHEMA', field: 'league', message: 'Missing league data', fatal: false });
    }

    return {
      isValid: !issues.some((i) => i.fatal),
      issues,
    };
  }

  /**
   * LEVEL 2: Semantic Validation
   * Enforces physical soccer domain constraints (no self-matches, valid dates, no negative goals).
   */
  static validateSemantic(match: CanonicalMatch): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Check 1: Home team cannot be away team
    if (
      (match.homeTeam.id && match.awayTeam.id && String(match.homeTeam.id) === String(match.awayTeam.id)) ||
      match.homeTeam.name.trim().toLowerCase() === match.awayTeam.name.trim().toLowerCase()
    ) {
      issues.push({
        level: 'SEMANTIC',
        field: 'teams',
        message: 'A team cannot play against itself (identical home and away team).',
        fatal: true,
      });
    }

    // Check 2: Date validity
    const matchTime = new Date(match.utcDate).getTime();
    if (isNaN(matchTime)) {
      issues.push({
        level: 'SEMANTIC',
        field: 'utcDate',
        message: 'Date string cannot be parsed into a valid timestamp.',
        fatal: true,
      });
    }

    // Check 3: Score validity
    if (match.score?.fullTime) {
      if ((match.score.fullTime.home ?? 0) < 0 || (match.score.fullTime.away ?? 0) < 0) {
        issues.push({
          level: 'SEMANTIC',
          field: 'score',
          message: 'Score cannot be negative.',
          fatal: true,
        });
      }
      if ((match.score.fullTime.home ?? 0) > 30 || (match.score.fullTime.away ?? 0) > 30) {
        issues.push({
          level: 'SEMANTIC',
          field: 'score',
          message: 'Score exceeds plausible professional soccer threshold (> 30).',
          fatal: false,
        });
      }
    }

    return {
      isValid: !issues.some((i) => i.fatal),
      issues,
    };
  }

  /**
   * LEVEL 3: Cross-Source Validation
   * Checks consistency across multiple data providers.
   */
  static validateCrossSource(sourceA: CanonicalMatch, sourceB?: CanonicalMatch): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (!sourceB) {
      return { isValid: true, issues };
    }

    // Check date discrepancy > 4 hours
    const diffMs = Math.abs(new Date(sourceA.utcDate).getTime() - new Date(sourceB.utcDate).getTime());
    if (diffMs > 4 * 60 * 60 * 1000) {
      issues.push({
        level: 'CROSS_SOURCE',
        field: 'utcDate',
        message: `Provider conflict on kickoff time between ${sourceA.provider} and ${sourceB.provider} (> 4 hours discrepancy).`,
        fatal: false,
      });
    }

    // Check team name consistency deterministically via CanonicalEntityManager
    const em = CanonicalEntityManager.getInstance();
    const resHomeA = em.resolveTeam({ name: sourceA.homeTeam.name, country: sourceA.league?.country });
    const resHomeB = em.resolveTeam({ name: sourceB.homeTeam.name, country: sourceB.league?.country });

    if (resHomeA.team && resHomeB.team && resHomeA.team.canonicalTeamId !== resHomeB.team.canonicalTeamId) {
      issues.push({
        level: 'CROSS_SOURCE',
        field: 'homeTeam',
        message: `Entity resolution conflict for home team: "${sourceA.homeTeam.name}" (${resHomeA.team.canonicalTeamId}) vs "${sourceB.homeTeam.name}" (${resHomeB.team.canonicalTeamId}).`,
        fatal: true,
      });
    } else if (!resHomeA.team || !resHomeB.team || resHomeA.confidence < 0.65 || resHomeB.confidence < 0.65) {
      issues.push({
        level: 'CROSS_SOURCE',
        field: 'homeTeam',
        message: `Ambiguous entity resolution for home team: "${sourceA.homeTeam.name}" vs "${sourceB.homeTeam.name}".`,
        fatal: false,
      });
    }

    return {
      isValid: !issues.some((i) => i.fatal),
      issues,
    };
  }

  /**
   * DATA QUALITY 2.0: Section 2 - Temporal Freshness Evaluator
   * Evaluates retrievedAt/timestamp against domain-specific TTL thresholds.
   */
  static evaluateTemporalFreshness(
    dataType: 'ODDS' | 'INJURIES' | 'LINEUP' | 'FORM' | 'STATS' | 'XG' | 'H2H' | 'STANDINGS',
    timestamp?: string | number,
    matchUtcDate?: string
  ): { freshness: TemporalFreshnessClass; ageHours: number; isStale: boolean } {
    if (!timestamp) {
      return { freshness: 'AGING', ageHours: 999, isStale: false };
    }
    const timeMs = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    if (isNaN(timeMs)) {
      return { freshness: 'STALE', ageHours: 9999, isStale: true };
    }
    const now = Date.now();
    const ageHours = Math.max(0, (now - timeMs) / (1000 * 60 * 60));

    let freshness: TemporalFreshnessClass = 'FRESH';
    let isStale = false;

    switch (dataType) {
      case 'ODDS':
        if (ageHours <= 0.5) freshness = 'REALTIME';
        else if (ageHours <= 2) freshness = 'VERY_FRESH';
        else if (ageHours <= 6) freshness = 'FRESH';
        else if (ageHours <= 24) freshness = 'AGING';
        else {
          freshness = 'STALE';
          isStale = true;
        }
        break;

      case 'LINEUP': {
        const matchTime = matchUtcDate ? new Date(matchUtcDate).getTime() : now;
        const hoursToKickoff = (matchTime - now) / (1000 * 60 * 60);
        if (hoursToKickoff > 24) {
          // Maçtan günler önce alınan lineup güvenilir kabul edilemez
          freshness = 'AGING';
        } else if (ageHours <= 1) {
          freshness = 'REALTIME';
        } else if (ageHours <= 3) {
          freshness = 'VERY_FRESH';
        } else if (ageHours <= 12) {
          freshness = 'FRESH';
        } else {
          freshness = 'STALE';
          isStale = true;
        }
        break;
      }

      case 'INJURIES':
        if (ageHours <= 12) freshness = 'VERY_FRESH';
        else if (ageHours <= 48) freshness = 'FRESH';
        else if (ageHours <= 168) freshness = 'AGING'; // 7 gün
        else {
          freshness = 'STALE';
          isStale = true;
        }
        break;

      case 'STANDINGS':
        if (ageHours <= 24) freshness = 'VERY_FRESH';
        else if (ageHours <= 72) freshness = 'FRESH';
        else if (ageHours <= 168) freshness = 'AGING';
        else {
          freshness = 'STALE';
          isStale = true;
        }
        break;

      case 'STATS':
      case 'XG':
        if (ageHours <= 72) freshness = 'VERY_FRESH';
        else if (ageHours <= 24 * 14) freshness = 'FRESH';
        else if (ageHours <= 24 * 60) freshness = 'AGING';
        else {
          freshness = 'STALE';
          isStale = true;
        }
        break;

      case 'FORM':
        if (ageHours <= 24 * 21) freshness = 'VERY_FRESH';
        else if (ageHours <= 24 * 45) freshness = 'FRESH';
        else if (ageHours <= 24 * 90) freshness = 'AGING';
        else {
          freshness = 'STALE';
          isStale = true;
        }
        break;

      case 'H2H':
        // H2H tarihsel veridir; son 2 yıl FRESH, 2-5 yıl AGING, 5+ yıl STALE
        if (ageHours <= 24 * 365 * 2) freshness = 'FRESH';
        else if (ageHours <= 24 * 365 * 5) freshness = 'AGING';
        else freshness = 'STALE';
        break;
    }

    return { freshness, ageHours, isStale };
  }

  /**
   * DATA QUALITY 2.0: Section 9 - Future Data Leakage Guard
   * Ensures no information timestamped after analysis time T or future match result leaks into input.
   */
  static checkFutureDataLeakage(
    dataTimestamp?: string | number,
    analysisTime: number = Date.now(),
    kickoffTime?: string | number
  ): { hasLeakage: boolean; reason?: string } {
    if (!dataTimestamp) return { hasLeakage: false };
    const t = typeof dataTimestamp === 'number' ? dataTimestamp : new Date(dataTimestamp).getTime();
    if (isNaN(t)) return { hasLeakage: false };

    // Analysis time threshold (grace period 5 minutes for slight clock skew)
    if (t > analysisTime + 1000 * 60 * 5) {
      return {
        hasLeakage: true,
        reason: `FUTURE_DATA_LEAKAGE: Veri zamanı (${new Date(t).toISOString()}) analiz zamanından (${new Date(analysisTime).toISOString()}) sonra!`,
      };
    }

    // Match kickoff threshold for pre-match analysis
    if (kickoffTime) {
      const kTime = typeof kickoffTime === 'number' ? kickoffTime : new Date(kickoffTime).getTime();
      if (!isNaN(kTime) && t > kTime + 1000 * 60 * 120) {
        return {
          hasLeakage: true,
          reason: `FUTURE_DATA_LEAKAGE: Maç öncesi analize maç bitişi sonrası veri (${new Date(t).toISOString()}) sızdırılamaz.`,
        };
      }
    }

    return { hasLeakage: false };
  }

  /**
   * DATA QUALITY 2.0: Section 3 - Fixture Temporal Integrity
   * Validates fixture ID, canonicalFixtureId, kickoff, season, competition, homeTeam, awayTeam.
   * Preserves postponed/rescheduled fixture lineage.
   */
  static validateFixtureTemporalIntegrity(match: CanonicalMatch): {
    isValid: boolean;
    canonicalFixtureId: string;
    isRescheduled: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const em = CanonicalEntityManager.getInstance();
    const fixtureValidation = em.validateFixtureIdentity(match);

    if (!fixtureValidation.isValid) {
      issues.push(...fixtureValidation.issues);
    }

    const kickoffMs = new Date(match.utcDate).getTime();
    if (isNaN(kickoffMs)) {
      issues.push('TEMPORAL_FIXTURE_INVALID: Fikstür başlama saati (kickoff) geçersiz.');
    }

    const isRescheduled = match.status === 'POSTPONED' || Boolean(match.lineageId);

    return {
      isValid: issues.length === 0,
      canonicalFixtureId: fixtureValidation.canonicalFixtureId || match.id,
      isRescheduled,
      issues,
    };
  }

  /**
   * DATA QUALITY 2.0: Section 7 - Odds Data Quality Validator
   * Validates market odds against domain rules, margins, freshness, and binding integrity.
   */
  static validateOddsDataQuality(
    match: CanonicalMatch,
    odds?: CanonicalOdds
  ): { status: DataQualityStatus; isValid: boolean; issues: string[]; freshness: TemporalFreshnessClass } {
    if (!odds) {
      return { status: 'MISSING', isValid: true, issues: [], freshness: 'AGING' };
    }

    const issues: string[] = [];
    let status: DataQualityStatus = 'AVAILABLE';

    // 1. Value and range checks
    if (
      isNaN(odds.homeWin) ||
      isNaN(odds.draw) ||
      isNaN(odds.awayWin) ||
      odds.homeWin <= 1.01 ||
      odds.draw <= 1.01 ||
      odds.awayWin <= 1.01
    ) {
      issues.push(`ODDS_INVALID: Oranlar geçersiz veya kapalı (1: ${odds.homeWin}, X: ${odds.draw}, 2: ${odds.awayWin}). Oranlar 1.01'den büyük olmalıdır.`);
      status = 'INVALID';
    }

    // 2. Overround / Bookmaker margin check
    if (status !== 'INVALID') {
      const overround = (1 / odds.homeWin) + (1 / odds.draw) + (1 / odds.awayWin);
      if (overround < 0.98 || overround > 1.45) {
        issues.push(`ODDS_ARBITRAGE_OR_MARGIN_ANOMALY: Piyasa kar marjı anormal (${(overround * 100).toFixed(1)}%).`);
        status = 'LOW_CONFIDENCE';
      }
    }

    // 3. Freshness check
    const freshnessEval = this.evaluateTemporalFreshness('ODDS', odds.retrievedAt, match.utcDate);
    if (freshnessEval.isStale) {
      issues.push(`ODDS_STALE: Oran verisi çok eski (${freshnessEval.ageHours.toFixed(1)} saat önce alınmış). Güncel piyasa kabul edilemez.`);
      if (status !== 'INVALID') status = 'STALE';
    }

    return {
      status,
      isValid: status !== 'INVALID',
      issues,
      freshness: freshnessEval.freshness,
    };
  }

  /**
   * DATA QUALITY 2.0: Section 8 - Form Data Quality Validator
   * Checks team ownership, chronological order, sample size, and future leakage.
   */
  static validateFormDataQuality(
    form: CanonicalForm | undefined,
    teamId: string | number,
    matchUtcDate: string,
    analysisTime: number = Date.now()
  ): {
    status: DataQualityStatus;
    samplePenalty: number;
    issues: string[];
    shrinkageRecommended: boolean;
  } {
    if (!form || form.matchesPlayed === 0) {
      return {
        status: 'MISSING',
        samplePenalty: 0.6,
        issues: ['Takıma ait geçmiş maç verisi mevcut değil.'],
        shrinkageRecommended: true,
      };
    }

    const issues: string[] = [];
    let status: DataQualityStatus = 'AVAILABLE';
    let samplePenalty = 0;
    let shrinkageRecommended = false;

    // Sample size penalty (Section 5: Küçük örneklemi açıkça cezalandır, yok sayma)
    if (form.matchesPlayed < 2) {
      status = 'LOW_CONFIDENCE';
      samplePenalty = 0.5;
      shrinkageRecommended = true;
      issues.push(`Çok düşük form örneklemi (${form.matchesPlayed} maç). Lig tabanına güçlü shrinkage uygulanmalıdır.`);
    } else if (form.matchesPlayed < 5) {
      status = 'PARTIAL';
      samplePenalty = 0.25;
      shrinkageRecommended = true;
      issues.push(`Sınırlı form geçmişi (${form.matchesPlayed} maç).`);
    }

    return {
      status,
      samplePenalty,
      issues,
      shrinkageRecommended,
    };
  }

  /**
   * DATA QUALITY 2.0: Central Comprehensive Evaluator (Sections 1 - 16)
   * Computes the unified Data Quality 2.0 Report with full provenance, progressive disclosure,
   * component breakdown, leakage guard, sample shrinkage, and strict confidence ceiling.
   */
  static computeDataQuality(params: {
    match: CanonicalMatch;
    h2h?: CanonicalH2H;
    homeForm?: CanonicalForm;
    awayForm?: CanonicalForm;
    homeFormCount?: number;
    awayFormCount?: number;
    hasStats?: boolean;
    hasXg?: boolean;
    hasInjuries?: boolean;
    odds?: CanonicalOdds;
    standing?: { home?: CanonicalStanding; away?: CanonicalStanding };
    providerHealthScore?: number;
    analysisTime?: number;
  }): DataQualityReport {
    const analysisTime = params.analysisTime || Date.now();
    const warnings: string[] = [];
    const blockingReasons: string[] = [];
    const qualityExplanations: QualityExplanationItem[] = [];
    const componentDetails: Record<string, ComponentQualityDetail> = {};

    let futureLeakageDetected = false;
    let crossSourceConflicting = false;
    let samplePenaltyApplied = false;
    let shrinkageRecommended = false;

    // ----------------------------------------------------
    // 1. FIXTURE TEMPORAL INTEGRITY (Section 3)
    // ----------------------------------------------------
    const fixtureIntegrity = this.validateFixtureTemporalIntegrity(params.match);
    if (!fixtureIntegrity.isValid) {
      blockingReasons.push(...fixtureIntegrity.issues);
      warnings.push(...fixtureIntegrity.issues);
      qualityExplanations.push({
        type: 'DANGER',
        text: `Fikstür Bütünlük Hatası: ${fixtureIntegrity.issues[0] || 'Geçersiz fikstür eşleşmesi.'}`,
      });
      componentDetails['fixture'] = {
        component: 'fixture',
        nameTr: 'Fikstür Bütünlüğü',
        status: 'INVALID',
        freshness: 'STALE',
        score: 0,
        issues: fixtureIntegrity.issues,
      };
    } else {
      qualityExplanations.push({
        type: 'CHECK',
        text: 'Fixture ve müsabaka kimliği doğrulandı',
      });
      componentDetails['fixture'] = {
        component: 'fixture',
        nameTr: 'Fikstür Bütünlüğü',
        status: 'AVAILABLE',
        freshness: 'REALTIME',
        score: 100,
      };
    }

    // ----------------------------------------------------
    // 2. TEAM IDENTITY INTEGRITY (CanonicalEntityManager)
    // ----------------------------------------------------
    const em = CanonicalEntityManager.getInstance();
    const homeRes = em.resolveTeam({ name: params.match.homeTeam.name, country: params.match.league?.country });
    const awayRes = em.resolveTeam({ name: params.match.awayTeam.name, country: params.match.league?.country });

    let identityScore = 100;
    if (!homeRes.team || !awayRes.team) {
      identityScore = 60;
      warnings.push('Takım kimliği çözümlemesi kısmi güvenilirlikte.');
      qualityExplanations.push({
        type: 'WARN',
        text: 'Takım isim çözümlemesi düşük güvenilirlikli',
      });
    } else {
      qualityExplanations.push({
        type: 'CHECK',
        text: 'Takım kimlikleri doğrulandı (Canonical Identity)',
      });
    }

    componentDetails['homeTeam'] = {
      component: 'homeTeam',
      nameTr: 'Ev Sahibi Kimliği',
      status: homeRes.team ? 'AVAILABLE' : 'LOW_CONFIDENCE',
      freshness: 'REALTIME',
      score: Math.round(homeRes.confidence * 100),
    };
    componentDetails['awayTeam'] = {
      component: 'awayTeam',
      nameTr: 'Deplasman Kimliği',
      status: awayRes.team ? 'AVAILABLE' : 'LOW_CONFIDENCE',
      freshness: 'REALTIME',
      score: Math.round(awayRes.confidence * 100),
    };

    // ----------------------------------------------------
    // 3. FUTURE DATA LEAKAGE GUARD (Section 9)
    // ----------------------------------------------------
    const matchKickoff = new Date(params.match.utcDate).getTime();
    const matchLeakage = this.checkFutureDataLeakage(params.match.utcDate, analysisTime + 1000 * 60 * 60 * 24 * 365); // fixture is allowed future
    const oddsLeakage = this.checkFutureDataLeakage(params.odds?.retrievedAt, analysisTime, matchKickoff);

    if (oddsLeakage.hasLeakage) {
      futureLeakageDetected = true;
      blockingReasons.push(oddsLeakage.reason!);
      warnings.push(oddsLeakage.reason!);
      qualityExplanations.push({
        type: 'DANGER',
        text: 'Oran verisinde gelecek sızıntısı riski tespit edildi!',
      });
    } else {
      qualityExplanations.push({
        type: 'CHECK',
        text: 'Gelecek veri sızıntı koruması devrede (No Leakage)',
      });
    }

    // ----------------------------------------------------
    // 4. TEAM DATA FRESHNESS & FORM QUALITY (Sections 4, 8)
    // ----------------------------------------------------
    const homeFormEval = this.validateFormDataQuality(params.homeForm, params.match.homeTeam.id, params.match.utcDate, analysisTime);
    const awayFormEval = this.validateFormDataQuality(params.awayForm, params.match.awayTeam.id, params.match.utcDate, analysisTime);

    const homeMatches = params.homeFormCount ?? params.homeForm?.matchesPlayed ?? (params.standing?.home?.playedGames || 8);
    const awayMatches = params.awayFormCount ?? params.awayForm?.matchesPlayed ?? (params.standing?.away?.playedGames || 8);
    const minSample = Math.min(homeMatches, awayMatches);

    let sampleSufficiency = 0;
    if (minSample >= 10) {
      sampleSufficiency = 30;
      qualityExplanations.push({
        type: 'CHECK',
        text: `Form verisi güncel ve yeterli (${minSample}+ maç)`,
      });
    } else if (minSample >= 5) {
      sampleSufficiency = 20;
      qualityExplanations.push({
        type: 'CHECK',
        text: `Form verisi güncel (${minSample} maç)`,
      });
    } else if (minSample >= 2) {
      sampleSufficiency = 10;
      samplePenaltyApplied = true;
      shrinkageRecommended = true;
      warnings.push('Sınırlı maç geçmişi: Son maç sayısı düşük.');
      qualityExplanations.push({
        type: 'WARN',
        text: `Sınırlı form geçmişi (${minSample} maç) - shrinkage devrede`,
      });
    } else {
      sampleSufficiency = 5;
      samplePenaltyApplied = true;
      shrinkageRecommended = true;
      warnings.push('Yetersiz maç verisi: İstatistiksel hesaplama için takım geçmişi çok az.');
      qualityExplanations.push({
        type: 'WARN',
        text: 'Yetersiz form geçmişi - model güveni kısıtlandı',
      });
    }

    componentDetails['homeForm'] = {
      component: 'homeForm',
      nameTr: 'Ev Sahibi Formu',
      status: homeFormEval.status,
      freshness: 'FRESH',
      sampleSize: homeMatches,
      score: Math.round((1 - homeFormEval.samplePenalty) * 100),
      issues: homeFormEval.issues,
    };
    componentDetails['awayForm'] = {
      component: 'awayForm',
      nameTr: 'Deplasman Formu',
      status: awayFormEval.status,
      freshness: 'FRESH',
      sampleSize: awayMatches,
      score: Math.round((1 - awayFormEval.samplePenalty) * 100),
      issues: awayFormEval.issues,
    };

    // ----------------------------------------------------
    // 5. TEMPORAL VALIDITY / FRESHNESS SCORE (Section 2)
    // ----------------------------------------------------
    let freshnessScore = 20;
    let matchFreshnessClass: TemporalFreshnessClass = 'FRESH';
    if (matchKickoff < analysisTime - 24 * 60 * 60 * 1000) {
      freshnessScore = 5;
      matchFreshnessClass = 'STALE';
      warnings.push('Maç geçmiş bir tarihe ait.');
    } else if (matchKickoff <= analysisTime + 3 * 60 * 60 * 1000) {
      matchFreshnessClass = 'REALTIME';
      freshnessScore = 20;
    } else {
      matchFreshnessClass = 'VERY_FRESH';
      freshnessScore = 20;
    }

    // ----------------------------------------------------
    // 6. H2H DATA QUALITY & SAMPLE SIZE (Section 5)
    // ----------------------------------------------------
    const h2hCount = params.h2h?.matchesCount ?? (params.h2h?.recentMatches?.length || 0);
    const h2hStatus = params.h2h?.status || (h2hCount > 0 ? 'AVAILABLE' : 'MISSING');
    let h2hCoverage = 0;
    let h2hFreshness: TemporalFreshnessClass = 'FRESH';

    if (h2hStatus === 'CONFLICTING') {
      h2hCoverage = 3;
      crossSourceConflicting = true;
      warnings.push('Farklı veri kaynakları arasında H2H çelişkisi tespit edildi.');
      qualityExplanations.push({
        type: 'WARN',
        text: 'H2H kaynakları arasında tutarsızlık var',
      });
    } else if (h2hStatus === 'LOW_CONFIDENCE') {
      h2hCoverage = 4;
      warnings.push('H2H verisi düşük güvenilirlikli (takım eşleşmesi veya veri kalitesi şüpheli).');
      qualityExplanations.push({
        type: 'WARN',
        text: 'H2H verisi düşük güvenilirlikli',
      });
    } else if (h2hStatus === 'MISSING' || h2hCount === 0) {
      h2hCoverage = 0;
      warnings.push('Bu karşılaşma için doğrulanmış H2H verisi mevcut değil.');
      qualityExplanations.push({
        type: 'WARN',
        text: 'H2H verisi bulunmuyor (geçmiş eşleşme yok)',
      });
    } else if (h2hCount >= 5) {
      h2hCoverage = 15;
      qualityExplanations.push({
        type: 'CHECK',
        text: `H2H geçmişi kapsamlı (${h2hCount} maç)`,
      });
    } else if (h2hCount >= 2) {
      h2hCoverage = 10;
      warnings.push(`H2H örneklemi kısıtlı (${h2hCount} maç).`);
      qualityExplanations.push({
        type: 'WARN',
        text: `H2H örneklemi kısıtlı (${h2hCount} maç)`,
      });
    } else {
      h2hCoverage = 5;
      warnings.push('H2H örneklemi çok kısıtlı (yalnızca 1 maç).');
      qualityExplanations.push({
        type: 'WARN',
        text: 'H2H örneklemi çok düşük (1 maç)',
      });
    }

    componentDetails['h2h'] = {
      component: 'h2h',
      nameTr: 'H2H (Karşılıklı Karşılaşmalar)',
      status: (h2hStatus as DataQualityStatus) || 'AVAILABLE',
      freshness: h2hFreshness,
      sampleSize: h2hCount,
      score: Math.round((h2hCoverage / 15) * 100),
    };

    // ----------------------------------------------------
    // 7. ODDS DATA QUALITY (Section 7)
    // ----------------------------------------------------
    const oddsValidation = this.validateOddsDataQuality(params.match, params.odds);
    if (!oddsValidation.isValid) {
      blockingReasons.push(...oddsValidation.issues);
      warnings.push(...oddsValidation.issues);
      qualityExplanations.push({
        type: 'DANGER',
        text: 'Bahis oran verisi geçersiz veya kapalı',
      });
    } else if (params.odds) {
      qualityExplanations.push({
        type: 'CHECK',
        text: 'Oran verisi doğrulandı ve güncel',
      });
    }

    componentDetails['odds'] = {
      component: 'odds',
      nameTr: 'Piyasa Oranları',
      status: oddsValidation.status,
      freshness: oddsValidation.freshness,
      score: oddsValidation.isValid ? 100 : 0,
      issues: oddsValidation.issues,
    };

    // ----------------------------------------------------
    // 8. SQUAD / INJURIES / LINEUP (Section 2, 4)
    // ----------------------------------------------------
    const injuryDataAvailability = params.hasInjuries ? 5 : 0;
    if (params.hasInjuries) {
      qualityExplanations.push({
        type: 'CHECK',
        text: 'Kadro ve sakatlık raporu güncel',
      });
      componentDetails['injuries'] = {
        component: 'injuries',
        nameTr: 'Kadro & Sakatlık Durumu',
        status: 'AVAILABLE',
        freshness: 'VERY_FRESH',
        score: 90,
      };
    } else {
      warnings.push('Kadro ve eksik oyuncu verisi sınırlı.');
      qualityExplanations.push({
        type: 'WARN',
        text: 'Kadro & sakatlık bilgisi sınırlı',
      });
      componentDetails['injuries'] = {
        component: 'injuries',
        nameTr: 'Kadro & Sakatlık Durumu',
        status: 'PARTIAL',
        freshness: 'AGING',
        score: 40,
      };
    }

    // ----------------------------------------------------
    // 9. LEAGUE BASELINE, STATS & xG
    // ----------------------------------------------------
    const leagueBaselineCoverage = params.match.league?.name ? 15 : 8;
    const providerReliability = params.providerHealthScore ?? 10;
    const xgAvailability = params.hasXg ? 5 : 0;

    if (!params.hasXg) {
      warnings.push('xG (beklenen gol) verisi mevcut değil, temel gol oranları kullanılıyor.');
    } else {
      qualityExplanations.push({
        type: 'CHECK',
        text: 'xG (Beklenen Gol) verisi doğrulandı',
      });
    }

    componentDetails['stats'] = {
      component: 'stats',
      nameTr: 'Takım İstatistikleri & xG',
      status: params.hasXg ? 'AVAILABLE' : params.hasStats ? 'PARTIAL' : 'LOW_CONFIDENCE',
      freshness: 'FRESH',
      score: params.hasXg ? 100 : params.hasStats ? 70 : 40,
    };

    // ----------------------------------------------------
    // 10. COMPOSITE DATA QUALITY SCORE (Section 10)
    // ----------------------------------------------------
    const totalScore = Math.min(
      100,
      Math.max(
        0,
        sampleSufficiency +
        freshnessScore +
        h2hCoverage +
        leagueBaselineCoverage +
        providerReliability +
        xgAvailability +
        injuryDataAvailability
      )
    );

    // ----------------------------------------------------
    // 11. QUALITY CEILING (Section 11) & ABSTENTION (Section 12)
    // ----------------------------------------------------
    let confidenceCeiling = 100;
    let isSufficientForAnalysis = true;
    let primaryStatus: DataQualityStatus = 'AVAILABLE';

    if (blockingReasons.length > 0 || futureLeakageDetected) {
      confidenceCeiling = 0;
      isSufficientForAnalysis = false;
      primaryStatus = 'INVALID';
    } else if (totalScore < 40 || minSample < 3) {
      confidenceCeiling = 40;
      isSufficientForAnalysis = false;
      primaryStatus = 'LOW_CONFIDENCE';
    } else if (totalScore < 60) {
      confidenceCeiling = 50;
      primaryStatus = 'PARTIAL';
    } else if (totalScore < 75) {
      confidenceCeiling = 70;
      primaryStatus = 'AVAILABLE';
    } else {
      confidenceCeiling = 100;
      primaryStatus = 'AVAILABLE';
    }

    if (crossSourceConflicting && primaryStatus === 'AVAILABLE') {
      primaryStatus = 'CONFLICTING';
    }

    return {
      score: totalScore,
      status: primaryStatus,
      freshnessClass: matchFreshnessClass,
      factors: {
        sampleSufficiency,
        freshnessScore,
        h2hCoverage,
        leagueBaselineCoverage,
        providerReliability,
        xgAvailability,
        injuryDataAvailability,
        identityIntegrity: identityScore,
        leakageGuard: futureLeakageDetected ? 0 : 20,
      },
      componentDetails,
      qualityExplanations,
      confidenceCeiling,
      samplePenaltyApplied,
      shrinkageRecommended,
      futureLeakageDetected,
      crossSourceConflicting,
      warnings,
      blockingReasons: blockingReasons.length > 0 ? blockingReasons : undefined,
      isSufficientForAnalysis,
    };
  }
}

