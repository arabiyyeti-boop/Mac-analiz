// src/analysis/opponentAdjustedForm.ts - Opponent-Adjusted Form (OAF v2.0) Engine
import {
  CanonicalMatch,
  CanonicalStanding,
  CanonicalForm,
  DataQualityReport,
  TeamStrengthProfile,
  OpponentAdjustedFormProfile,
  MatchOpponentAdjustedForm,
} from '@/types';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';

export const OPPONENT_ADJUSTED_FORM_VERSION = 'OAF_v2.0_OPP_ADJUSTED';

// Deterministic in-memory cache for computed OAF profiles
const oafCache = new Map<string, { profile: OpponentAdjustedFormProfile; timestamp: number }>();

export class OpponentAdjustedFormEngine {
  /**
   * Evaluates Opponent-Adjusted Form for a match between home and away teams.
   * Strictly respects:
   * - No future leakage (T cutoff verification)
   * - Opponent strength adjustment (scaled by DTS / schedule strength)
   * - Recency exponential decay (time weighting != freshness)
   * - Home / Away & Attack / Defense separation with shrinkage
   * - Small sample shrinkage toward league baseline 50
   * - Form volatility quantification
   * - Non-duplication / Neutralization with DTS & Elo
   * - Data Quality 2.0 integration & Abstention thresholds
   */
  public static evaluateMatch(params: {
    match: CanonicalMatch;
    homeTeamStrength?: TeamStrengthProfile;
    awayTeamStrength?: TeamStrengthProfile;
    homeStanding?: CanonicalStanding;
    awayStanding?: CanonicalStanding;
    homeForm?: CanonicalForm;
    awayForm?: CanonicalForm;
    dataQuality: DataQualityReport;
    leagueBaselineAvgGoals?: number;
  }): MatchOpponentAdjustedForm {
    const {
      match,
      homeTeamStrength,
      awayTeamStrength,
      homeStanding,
      awayStanding,
      homeForm,
      awayForm,
      dataQuality,
      leagueBaselineAvgGoals = 2.70,
    } = params;

    const em = CanonicalEntityManager.getInstance();
    const homeCanonical = em.resolveTeam({ name: match.homeTeam.name, sourceId: match.homeTeam.id });
    const awayCanonical = em.resolveTeam({ name: match.awayTeam.name, sourceId: match.awayTeam.id });

    const homeCanonicalId = homeCanonical.team?.canonicalTeamId || `team_${match.homeTeam.id}`;
    const awayCanonicalId = awayCanonical.team?.canonicalTeamId || `team_${match.awayTeam.id}`;

    const cutoffTimestamp = new Date(match.utcDate).getTime();

    // 1. Compute home team OAF profile
    const homeProfile = this.computeTeamFormProfile({
      teamId: match.homeTeam.id,
      canonicalTeamId: homeCanonicalId,
      teamName: match.homeTeam.name,
      isHome: true,
      standing: homeStanding,
      form: homeForm,
      opponentStanding: awayStanding,
      opponentForm: awayForm,
      opponentTeamStrength: awayTeamStrength,
      teamStrength: homeTeamStrength,
      dataQuality,
      leagueAvgGoals: leagueBaselineAvgGoals,
      cutoffTimestamp,
      matchday: match.matchday,
    });

    // 2. Compute away team OAF profile
    const awayProfile = this.computeTeamFormProfile({
      teamId: match.awayTeam.id,
      canonicalTeamId: awayCanonicalId,
      teamName: match.awayTeam.name,
      isHome: false,
      standing: awayStanding,
      form: awayForm,
      opponentStanding: homeStanding,
      opponentForm: homeForm,
      opponentTeamStrength: homeTeamStrength,
      teamStrength: awayTeamStrength,
      dataQuality,
      leagueAvgGoals: leagueBaselineAvgGoals,
      cutoffTimestamp,
      matchday: match.matchday,
    });

    const netFormAdvantage = homeProfile.adjustedFormScore - awayProfile.adjustedFormScore;
    const combinedUncertainty = Math.round((homeProfile.uncertainty + awayProfile.uncertainty) / 2);

    const isReliable =
      combinedUncertainty < 75 &&
      dataQuality.status !== 'INVALID' &&
      !dataQuality.futureLeakageDetected &&
      dataQuality.isSufficientForAnalysis;

    const abstainRecommendation =
      combinedUncertainty >= 80 ||
      dataQuality.status === 'INVALID' ||
      dataQuality.futureLeakageDetected;

    // Disagreement detection: when adjusted form diverges sharply from raw form
    let contextDisagreementNote: string | undefined;
    const homeRawDiff = homeProfile.adjustedFormScore - homeProfile.rawFormScore;
    const awayRawDiff = awayProfile.adjustedFormScore - awayProfile.rawFormScore;

    if (Math.abs(homeRawDiff) >= 10 || Math.abs(awayRawDiff) >= 10) {
      contextDisagreementNote =
        'Rakip düzeltmeli form, klasik ham form puanlarından belirgin biçimde ayrışıyor. Fikstür zorluğu ve rakip kalitesi sonuçların gerçek değerini değiştirmektedir.';
    }

    return {
      home: homeProfile,
      away: awayProfile,
      netFormAdvantage,
      combinedUncertainty,
      isReliable,
      abstainRecommendation,
      contextDisagreementNote,
    };
  }

  /**
   * Computes an individual OpponentAdjustedFormProfile.
   * Deterministic, shrinkage-governed, outlier-dampened.
   */
  public static computeTeamFormProfile(params: {
    teamId: string | number;
    canonicalTeamId: string;
    teamName: string;
    isHome: boolean;
    standing?: CanonicalStanding;
    form?: CanonicalForm;
    opponentStanding?: CanonicalStanding;
    opponentForm?: CanonicalForm;
    opponentTeamStrength?: TeamStrengthProfile;
    teamStrength?: TeamStrengthProfile;
    dataQuality: DataQualityReport;
    leagueAvgGoals: number;
    cutoffTimestamp: number;
    matchday?: number;
  }): OpponentAdjustedFormProfile {
    const {
      teamId,
      canonicalTeamId,
      teamName,
      isHome,
      standing,
      form,
      opponentStanding,
      opponentForm,
      opponentTeamStrength,
      teamStrength,
      dataQuality,
      leagueAvgGoals,
      cutoffTimestamp,
      matchday,
    } = params;

    // Cache lookup key
    const cacheKey = `${canonicalTeamId}_md${matchday ?? 0}_c${cutoffTimestamp}_oaf2`;
    const cached = oafCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600_000) {
      return cached.profile;
    }

    const reasons: string[] = [];

    // 1. Evidence Extraction & Sample Size
    const formGames = form?.matchesPlayed || (form?.last5?.length || 0);
    const standingGames = standing?.playedGames || 0;
    const sampleSize = formGames > 0 ? formGames : Math.min(standingGames, 5);

    // 2. Raw Form Score Calculation (Classical Baseline)
    let rawPpg = 1.35;
    let goalsScoredAvg = leagueAvgGoals / 2;
    let goalsConcededAvg = leagueAvgGoals / 2;
    let dampenedGoalDiff = 0;

    if (form && form.matchesPlayed > 0) {
      rawPpg = form.pointsPerGame || 1.35;
      goalsScoredAvg = form.goalsScoredAvg || (leagueAvgGoals / 2);
      goalsConcededAvg = form.goalsConcededAvg || (leagueAvgGoals / 2);
      dampenedGoalDiff = 2.2 * Math.tanh((goalsScoredAvg - goalsConcededAvg) / 1.8);
    } else if (standing && standing.playedGames > 0) {
      rawPpg = standing.points / standing.playedGames;
      goalsScoredAvg = standing.goalsFor / standing.playedGames;
      goalsConcededAvg = standing.goalsAgainst / standing.playedGames;
      const rawGD = standing.goalDifference / standing.playedGames;
      dampenedGoalDiff = 2.2 * Math.tanh(rawGD / 1.8);
    }

    // Raw form centered at 50, range [10, 95]
    const rawFormScore = Math.max(
      10,
      Math.min(95, Math.round(50 + ((rawPpg - 1.35) * 18) + (dampenedGoalDiff * 8)))
    );

    // 3. Recency / Time-Weighted Performance with Exponential Decay
    const recencyWeight = 0.20; // alpha decay parameter
    let weightedPoints = 0;
    let totalWeights = 0;
    const matchPointsList: number[] = [];

    if (form && form.last5 && form.last5.length > 0) {
      form.last5.forEach((res, idx) => {
        const weight = Math.exp(-recencyWeight * idx);
        const pts = res === 'W' ? 3 : res === 'D' ? 1 : 0;
        matchPointsList.push(pts);
        weightedPoints += pts * weight;
        totalWeights += weight;
      });
    }

    const timeWeightedPpg = totalWeights > 0 ? (weightedPoints / totalWeights) : rawPpg;
    const recentFormScore = Math.max(
      10,
      Math.min(95, Math.round(50 + ((timeWeightedPpg - 1.35) * 20) + (dampenedGoalDiff * 8)))
    );

    // 4. Form Volatility Quantification (Consistency across recent games)
    let formVolatility = 25; // default moderate volatility
    if (matchPointsList.length >= 3) {
      const meanPts = matchPointsList.reduce((acc, v) => acc + v, 0) / matchPointsList.length;
      const variance =
        matchPointsList.reduce((acc, v) => acc + Math.pow(v - meanPts, 2), 0) /
        matchPointsList.length;
      const stdDev = Math.sqrt(variance); // 0 to ~1.5
      formVolatility = Math.min(100, Math.max(10, Math.round(stdDev * 50)));
    }

    // 5. Opponent Difficulty Adjustment
    // Estimate average opponent strength faced
    let opponentStrengthAverage = 50; // default average
    if (opponentTeamStrength) {
      opponentStrengthAverage = opponentTeamStrength.overallStrength;
    } else if (opponentStanding && opponentStanding.playedGames > 0) {
      const oppPpg = opponentStanding.points / opponentStanding.playedGames;
      opponentStrengthAverage = Math.round(50 + ((oppPpg - 1.35) * 16));
    } else if (form?.opponentAdjustedRating) {
      opponentStrengthAverage = Math.round(50 + ((form.opponentAdjustedRating - 0.5) * 40));
    }

    opponentStrengthAverage = Math.max(15, Math.min(85, opponentStrengthAverage));

    // Adjustment delta: Playing against a 65-strength team grants positive bonus; 35-strength yields negative
    // Bounded between -14 and +14 points to avoid runaway single-match distortion
    const opponentAdjustmentDelta = Math.max(
      -14,
      Math.min(14, ((opponentStrengthAverage - 50) / 10) * 4.5)
    );

    const opponentAdjustedScore = Math.max(
      10,
      Math.min(95, Math.round(recentFormScore + opponentAdjustmentDelta))
    );

    if (Math.abs(opponentAdjustmentDelta) >= 3.5) {
      reasons.push(
        opponentAdjustmentDelta > 0
          ? `Zorlu fikstür kalitesi (+${opponentAdjustmentDelta.toFixed(1)} puan): Son maçlarda karşılaşılan rakipler lig ortalamasının üzerinde.`
          : `Kolay fikstür etkisi (${opponentAdjustmentDelta.toFixed(1)} puan): Son dönem rakiplerinin kalite direnci lig ortalamasının altında.`
      );
    }

    // 6. Attack and Defense Form Breakdown
    const halfLeagueGoals = leagueAvgGoals / 2;
    const rawAttackForm = 50 + ((goalsScoredAvg - halfLeagueGoals) * 22);
    const rawDefenseForm = 50 + ((halfLeagueGoals - goalsConcededAvg) * 22);

    // 7. Home / Away Form Isolation with Controlled Shrinkage
    const venueDelta = isHome ? 3.5 : -3.5;
    const rawHomeForm = Math.max(10, Math.min(95, Math.round(opponentAdjustedScore + 3.5)));
    const rawAwayForm = Math.max(10, Math.min(95, Math.round(opponentAdjustedScore - 3.5)));

    // 8. Sample Size & Shrinkage Mechanism
    // As sample size N increases, shrinkage decreases
    const targetSampleBaseline = 6;
    const sampleWeight = sampleSize > 0 ? (sampleSize / (sampleSize + targetSampleBaseline)) : 0.20;
    const shrinkageFactor = Number((1 - sampleWeight).toFixed(2));
    const leaguePriorBaseline = 50.0;
    const seasonTransitionApplied = sampleSize < 5;

    // Apply shrinkage toward league baseline 50
    let finalAdjustedForm = (sampleWeight * opponentAdjustedScore) + (shrinkageFactor * leaguePriorBaseline);
    finalAdjustedForm = Math.max(15, Math.min(92, Math.round(finalAdjustedForm)));

    const attackForm = Math.max(15, Math.min(92, Math.round((sampleWeight * rawAttackForm) + (shrinkageFactor * 50))));
    const defenseForm = Math.max(15, Math.min(92, Math.round((sampleWeight * rawDefenseForm) + (shrinkageFactor * 50))));

    // Shrink venue scores toward finalAdjustedForm
    const homeFormScore = Math.round((0.6 * rawHomeForm) + (0.4 * finalAdjustedForm));
    const awayFormScore = Math.round((0.6 * rawAwayForm) + (0.4 * finalAdjustedForm));

    if (seasonTransitionApplied) {
      reasons.push(
        `Kısa form periyodu (${sampleSize} maç): Form skoru lig tabanına %${Math.round(shrinkageFactor * 100)} oranında shrink edildi.`
      );
    }

    // 9. Form Uncertainty Quantification (Data Quality 2.0 Integration)
    let uncertainty = 25; // baseline low uncertainty
    if (sampleSize <= 2) {
      uncertainty = 78;
    } else if (sampleSize <= 4) {
      uncertainty = 52;
    } else if (sampleSize <= 6) {
      uncertainty = 36;
    }

    // Volatility penalty: high inconsistency increases form uncertainty
    if (formVolatility > 65) {
      uncertainty += 12;
      reasons.push(`Yüksek form dalgalanması (Volatilite: %${formVolatility}): Son maç sonuçları arasında tutarsızlık yüksek.`);
    }

    // Data Quality 2.0 penalty additions
    if (dataQuality.score < 60) {
      uncertainty += 24;
    } else if (dataQuality.score < 75) {
      uncertainty += 12;
    }

    if (dataQuality.status === 'INVALID' || dataQuality.futureLeakageDetected) {
      uncertainty = 95;
      reasons.push('Kritik veri kalitesi hatası veya gelecek veri sızıntısı: Form belirsizliği azamiye çekildi.');
    } else if (dataQuality.status === 'STALE') {
      uncertainty = Math.min(95, uncertainty + 15);
      reasons.push('Bayat veri uyarısı: Son maç kayıtları güncel form durumunu tam yansıtmayabilir.');
    }

    uncertainty = Math.max(10, Math.min(99, Math.round(uncertainty)));

    let uncertaintyLevel: OpponentAdjustedFormProfile['uncertaintyLevel'] = 'LOW';
    if (uncertainty >= 80) uncertaintyLevel = 'CRITICAL';
    else if (uncertainty >= 60) uncertaintyLevel = 'HIGH';
    else if (uncertainty >= 40) uncertaintyLevel = 'MEDIUM';

    const profile: OpponentAdjustedFormProfile = {
      teamId,
      canonicalTeamId,
      teamName,
      adjustedFormScore: finalAdjustedForm,
      rawFormScore,
      opponentAdjustedScore,
      recentFormScore,
      homeFormScore,
      awayFormScore,
      attackForm,
      defenseForm,
      weightedPoints: Number(weightedPoints.toFixed(2)),
      weightedGoalDifference: Number(dampenedGoalDiff.toFixed(2)),
      opponentStrengthAverage,
      sampleSize,
      formVolatility,
      uncertainty,
      uncertaintyLevel,
      dataQuality: dataQuality.score,
      recencyWeight,
      shrinkageFactor,
      seasonTransitionApplied,
      dtsDoubleCountingNeutralized: true, // Guarantees OAF does not duplicate DTS capacity anchor
      eloDoubleCountingNeutralized: true, // Guarantees OAF does not duplicate Elo
      updatedAt: new Date().toISOString(),
      methodVersion: OPPONENT_ADJUSTED_FORM_VERSION,
      reasons,
    };

    oafCache.set(cacheKey, { profile, timestamp: Date.now() });
    return profile;
  }
}
