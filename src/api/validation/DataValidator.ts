// src/api/validation/DataValidator.ts - Multi-tier Validation System
import { CanonicalMatch, CanonicalStats, CanonicalH2H, DataQualityReport } from '@/types';

export interface ValidationIssue {
  level: 'SCHEMA' | 'SEMANTIC' | 'CROSS_SOURCE';
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

    // Check team name consistency
    const cleanHomeA = sourceA.homeTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanHomeB = sourceB.homeTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanHomeA.includes(cleanHomeB) && !cleanHomeB.includes(cleanHomeA)) {
      issues.push({
        level: 'CROSS_SOURCE',
        field: 'homeTeam',
        message: `Potential entity resolution mismatch for home team: "${sourceA.homeTeam.name}" vs "${sourceB.homeTeam.name}".`,
        fatal: false,
      });
    }

    return {
      isValid: !issues.some((i) => i.fatal),
      issues,
    };
  }

  /**
   * Evaluates Data Quality (0-100) based on sample sizes, freshness, stats, H2H, xG
   */
  static computeDataQuality(params: {
    match: CanonicalMatch;
    h2h?: CanonicalH2H;
    homeFormCount?: number;
    awayFormCount?: number;
    hasStats?: boolean;
    hasXg?: boolean;
    hasInjuries?: boolean;
    providerHealthScore?: number;
  }): DataQualityReport {
    const warnings: string[] = [];

    // Factor 1: Sample Sufficiency (max 30 points)
    const homeMatches = params.homeFormCount ?? 0;
    const awayMatches = params.awayFormCount ?? 0;
    const minSample = Math.min(homeMatches, awayMatches);
    let sampleSufficiency = 0;
    if (minSample >= 10) sampleSufficiency = 30;
    else if (minSample >= 5) sampleSufficiency = 20;
    else if (minSample >= 2) {
      sampleSufficiency = 10;
      warnings.push('Sınırlı maç geçmişi: Son maç sayısı düşük.');
    } else {
      sampleSufficiency = 5;
      warnings.push('Yetersiz maç verisi: İstatistiksel hesaplama için takım geçmişi çok az.');
    }

    // Factor 2: Freshness Score (max 20 points)
    const matchTime = new Date(params.match.utcDate).getTime();
    const now = Date.now();
    let freshnessScore = 20;
    if (matchTime < now - 24 * 60 * 60 * 1000) {
      freshnessScore = 5;
      warnings.push('Maç geçmiş bir tarihe ait.');
    }

    // Factor 3: H2H Coverage (max 15 points)
    const h2hCount = params.h2h?.matchesCount ?? 0;
    let h2hCoverage = 0;
    if (h2hCount >= 5) h2hCoverage = 15;
    else if (h2hCount >= 2) h2hCoverage = 10;
    else if (h2hCount === 1) h2hCoverage = 5;
    else {
      h2hCoverage = 2;
      warnings.push('H2H (ikili mücadele) geçmişi bulunamadı veya çok kısıtlı.');
    }

    // Factor 4: League Baseline Coverage (max 15 points)
    const leagueBaselineCoverage = params.match.league?.name ? 15 : 8;

    // Factor 5: Provider Reliability (max 10 points)
    const providerReliability = params.providerHealthScore ?? 10;

    // Factor 6: xG Availability (max 5 points)
    const xgAvailability = params.hasXg ? 5 : 0;
    if (!params.hasXg) {
      warnings.push('xG (beklenen gol) verisi mevcut değil, temel gol oranları kullanılıyor.');
    }

    // Factor 7: Injury data (max 5 points)
    const injuryDataAvailability = params.hasInjuries ? 5 : 0;

    const totalScore = Math.min(
      100,
      sampleSufficiency +
      freshnessScore +
      h2hCoverage +
      leagueBaselineCoverage +
      providerReliability +
      xgAvailability +
      injuryDataAvailability
    );

    const isSufficientForAnalysis = totalScore >= 40 && minSample >= 3;

    return {
      score: totalScore,
      factors: {
        sampleSufficiency,
        freshnessScore,
        h2hCoverage,
        leagueBaselineCoverage,
        providerReliability,
        xgAvailability,
        injuryDataAvailability,
      },
      warnings,
      isSufficientForAnalysis,
    };
  }
}
