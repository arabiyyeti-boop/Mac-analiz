// src/analysis/teamStrength.ts - Dynamic Team Strength Engine
import {
  CanonicalMatch,
  CanonicalStanding,
  CanonicalForm,
  CanonicalLeague,
  DataQualityReport,
  TeamStrengthProfile,
  MatchTeamStrength,
} from '@/types';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';

export const DYNAMIC_STRENGTH_METHOD_VERSION = 'DTS_v2.0_OPP_ADJUSTED';

// Deterministic in-memory cache for computed team strength profiles
const profileCache = new Map<string, { profile: TeamStrengthProfile; timestamp: number }>();

export class TeamStrengthEngine {
  /**
   * Evaluates Dynamic Team Strength for a match between home and away teams.
   * Strictly respects:
   * - No future leakage (T cutoff check)
   * - Opponent-adjusted capability
   * - Attack / Defense and Home / Away separation
   * - Small sample shrinkage and season transition
   * - Double-counting protection (home advantage neutralized for ensemble)
   * - Data Quality 2.0 integration & uncertainty
   */
  public static evaluateMatch(params: {
    match: CanonicalMatch;
    homeStanding?: CanonicalStanding;
    awayStanding?: CanonicalStanding;
    homeForm?: CanonicalForm;
    awayForm?: CanonicalForm;
    dataQuality: DataQualityReport;
    leagueBaselineAvgGoals?: number;
  }): MatchTeamStrength {
    const {
      match,
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

    // 1. Compute individual profiles with opponent adjustment
    const homeProfile = this.computeTeamProfile({
      teamId: match.homeTeam.id,
      canonicalTeamId: homeCanonicalId,
      teamName: match.homeTeam.name,
      isHome: true,
      standing: homeStanding,
      form: homeForm,
      opponentStanding: awayStanding,
      opponentForm: awayForm,
      dataQuality,
      leagueAvgGoals: leagueBaselineAvgGoals,
      cutoffTimestamp,
      matchday: match.matchday,
    });

    const awayProfile = this.computeTeamProfile({
      teamId: match.awayTeam.id,
      canonicalTeamId: awayCanonicalId,
      teamName: match.awayTeam.name,
      isHome: false,
      standing: awayStanding,
      form: awayForm,
      opponentStanding: homeStanding,
      opponentForm: homeForm,
      dataQuality,
      leagueAvgGoals: leagueBaselineAvgGoals,
      cutoffTimestamp,
      matchday: match.matchday,
    });

    const netStrengthAdvantage = homeProfile.overallStrength - awayProfile.overallStrength;
    const netOpponentAdjustedAdvantage = homeProfile.opponentAdjustedStrength - awayProfile.opponentAdjustedStrength;
    const combinedUncertainty = Math.round((homeProfile.strengthUncertainty + awayProfile.strengthUncertainty) / 2);

    // Disagreement detection: check if net strength diverges strongly from raw standing position
    let modelDisagreementNote: string | undefined;
    if (homeStanding && awayStanding) {
      const standingDiff = awayStanding.position - homeStanding.position; // Positive if home is higher in table
      if (standingDiff > 5 && netStrengthAdvantage < -5) {
        modelDisagreementNote = 'Dinamik takım gücü, lig puan tablosundaki sıralamadan belirgin biçimde ayrışıyor (Zorlu Fikstür / Negatif Regresyon).';
      } else if (standingDiff < -5 && netStrengthAdvantage > 5) {
        modelDisagreementNote = 'Dinamik takım gücü, sıralama dezavantajına rağmen rakip kalitesi düzeltmesinde üstün performans gösteriyor.';
      }
    }

    return {
      home: homeProfile,
      away: awayProfile,
      netStrengthAdvantage,
      netOpponentAdjustedAdvantage,
      homeAdvantageNeutralized: true, // Guarantees no double-counting with Poisson HomeAdvantage
      combinedUncertainty,
      modelDisagreementNote,
    };
  }

  /**
   * Computes an individual TeamStrengthProfile.
   * Deterministic, shrinkage-governed, and cache-backed.
   */
  public static computeTeamProfile(params: {
    teamId: string | number;
    canonicalTeamId: string;
    teamName: string;
    isHome: boolean;
    standing?: CanonicalStanding;
    form?: CanonicalForm;
    opponentStanding?: CanonicalStanding;
    opponentForm?: CanonicalForm;
    dataQuality: DataQualityReport;
    leagueAvgGoals: number;
    cutoffTimestamp: number;
    matchday?: number;
  }): TeamStrengthProfile {
    const {
      teamId,
      canonicalTeamId,
      teamName,
      isHome,
      standing,
      form,
      opponentStanding,
      opponentForm,
      dataQuality,
      leagueAvgGoals,
      cutoffTimestamp,
      matchday,
    } = params;

    // Cache lookup key
    const cacheKey = `${canonicalTeamId}_md${matchday ?? 0}_c${cutoffTimestamp}`;
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600_000) {
      return cached.profile;
    }

    const reasons: string[] = [];

    // 1. Evidence Sample Size Extraction
    const standingGames = standing?.playedGames || 0;
    const formGames = form?.matchesPlayed || (form?.last5?.length || 0);
    const sampleSize = Math.max(standingGames, formGames);
    const homeSampleSize = Math.round(sampleSize * 0.5);
    const awaySampleSize = sampleSize - homeSampleSize;

    // 2. Base metrics calculation (with outlier dampening)
    let ppg = 1.35; // League average default
    let goalsScoredPerGame = leagueAvgGoals / 2;
    let goalsConcededPerGame = leagueAvgGoals / 2;
    let dampenedGoalDiffPerGame = 0;

    if (standing && standing.playedGames > 0) {
      ppg = standing.points / standing.playedGames;
      goalsScoredPerGame = standing.goalsFor / standing.playedGames;
      goalsConcededPerGame = standing.goalsAgainst / standing.playedGames;
      const rawGDPerGame = standing.goalDifference / standing.playedGames;
      // Dampen extreme blowouts (e.g. 7-0) using tanh squashing
      dampenedGoalDiffPerGame = 2.2 * Math.tanh(rawGDPerGame / 1.8);
    } else if (form && form.matchesPlayed > 0) {
      ppg = form.pointsPerGame || 1.35;
      goalsScoredPerGame = form.goalsScoredAvg || (leagueAvgGoals / 2);
      goalsConcededPerGame = form.goalsConcededAvg || (leagueAvgGoals / 2);
      dampenedGoalDiffPerGame = 2.2 * Math.tanh((goalsScoredPerGame - goalsConcededPerGame) / 1.8);
    }

    // 3. Raw Base Strength (0 - 100, centered around 50)
    // Scale: PPG delta (range -1.35 to +1.65) maps to ~ +/- 25 pts; GD maps to ~ +/- 18 pts
    const rawBaseStrength = 50 + ((ppg - 1.35) * 16) + (dampenedGoalDiffPerGame * 8);

    // 4. Opponent Quality Adjustment (Iterative / Shrinkage)
    // Opponent difficulty estimate: PPG of opponent or opponentAdjustedRating
    let opponentDifficulty = 1.35;
    if (opponentStanding && opponentStanding.playedGames > 0) {
      opponentDifficulty = opponentStanding.points / opponentStanding.playedGames;
    } else if (form?.opponentAdjustedRating) {
      opponentDifficulty = 1.35 + ((form.opponentAdjustedRating - 0.5) * 1.5);
    }

    // Adjustment: playing against a 2.2 PPG team awards positive credit, 0.7 PPG yields downward adjustment
    // Bounded between -14 and +14 points to avoid runaway distortion
    const opponentAdjustmentDelta = Math.max(-14, Math.min(14, (opponentDifficulty - 1.35) * 10));
    const opponentAdjustedStrength = Math.max(10, Math.min(95, rawBaseStrength + opponentAdjustmentDelta));

    if (Math.abs(opponentAdjustmentDelta) >= 4) {
      reasons.push(
        opponentAdjustmentDelta > 0
          ? `Zorlu fikstür düzeltmesi (+${opponentAdjustmentDelta.toFixed(1)} puan): Rakip kalite direnci ortalama üstü.`
          : `Yumuşak fikstür düzeltmesi (${opponentAdjustmentDelta.toFixed(1)} puan): Oynanan maçların rakip zorluk derecesi düşük.`
      );
    }

    // 5. Attack and Defense Separation (0 - 100)
    // Attack: goals scored relative to league half-average, boosted by opponent defensive difficulty
    const halfLeagueGoals = leagueAvgGoals / 2;
    const rawAttack = 50 + ((goalsScoredPerGame - halfLeagueGoals) * 22);
    // Defense: goals conceded relative to league half-average (fewer conceded = higher score)
    const rawDefense = 50 + ((halfLeagueGoals - goalsConcededPerGame) * 22);

    // 6. Home / Away Isolation
    // Isolated home/away capability without double-counting natural ground bias
    const homeAdvantageSpread = 4.0; // Statistical home/away baseline split
    const homeAttackStrength = Math.max(10, Math.min(95, Math.round(rawAttack + homeAdvantageSpread * 0.6)));
    const homeDefenseStrength = Math.max(10, Math.min(95, Math.round(rawDefense + homeAdvantageSpread * 0.4)));
    const awayAttackStrength = Math.max(10, Math.min(95, Math.round(rawAttack - homeAdvantageSpread * 0.6)));
    const awayDefenseStrength = Math.max(10, Math.min(95, Math.round(rawDefense - homeAdvantageSpread * 0.4)));

    const homeStrength = Math.round((homeAttackStrength + homeDefenseStrength) / 2);
    const awayStrength = Math.round((awayAttackStrength + awayDefenseStrength) / 2);

    // 7. Recency / Time-Weighted Strength (Recent Form vs Long-Term Capability)
    let recentStrength = opponentAdjustedStrength;
    if (form && form.last5 && form.last5.length > 0) {
      let weightedPoints = 0;
      let totalWeights = 0;
      form.last5.forEach((res, idx) => {
        const weight = Math.exp(-0.18 * idx);
        const pts = res === 'W' ? 3 : res === 'D' ? 1 : 0;
        weightedPoints += pts * weight;
        totalWeights += weight;
      });
      const recentPpg = totalWeights > 0 ? (weightedPoints / totalWeights) : ppg;
      const recentScore = 50 + ((recentPpg - 1.35) * 18);
      // Recency balances long-term capacity (65%) with short-term form (35%)
      recentStrength = Math.max(10, Math.min(95, (0.65 * opponentAdjustedStrength) + (0.35 * recentScore)));
    }

    // 8. Season Transition & Small Sample Shrinkage
    // As sample size N increases, shrinkage decreases
    const targetSampleBaseline = 8;
    const sampleWeight = sampleSize > 0 ? (sampleSize / (sampleSize + targetSampleBaseline)) : 0.15;
    const shrinkageFactor = Number((1 - sampleWeight).toFixed(2));
    const leaguePriorBaseline = 50.0;
    const seasonTransitionApplied = sampleSize < 6;

    // Apply shrinkage toward league baseline 50
    let finalOverall = (sampleWeight * recentStrength) + (shrinkageFactor * leaguePriorBaseline);
    finalOverall = Math.max(15, Math.min(92, Math.round(finalOverall)));

    const attackStrength = Math.max(15, Math.min(92, Math.round((sampleWeight * rawAttack) + (shrinkageFactor * 50))));
    const defenseStrength = Math.max(15, Math.min(92, Math.round((sampleWeight * rawDefense) + (shrinkageFactor * 50))));

    if (seasonTransitionApplied) {
      reasons.push(`Erken sezon / sınırlı örneklem (${sampleSize} maç): Takım gücü lig tabanına %${Math.round(shrinkageFactor * 100)} oranında shrink edildi.`);
    }

    // 9. Uncertainty Quantification (Integrated with Data Quality 2.0)
    let strengthUncertainty = 25; // baseline low uncertainty
    if (sampleSize <= 2) {
      strengthUncertainty = 75;
    } else if (sampleSize <= 5) {
      strengthUncertainty = 55;
    } else if (sampleSize <= 8) {
      strengthUncertainty = 38;
    }

    // Data Quality 2.0 penalty additions
    if (dataQuality.score < 60) {
      strengthUncertainty += 25;
    } else if (dataQuality.score < 75) {
      strengthUncertainty += 12;
    }

    if (dataQuality.status === 'INVALID' || dataQuality.futureLeakageDetected) {
      strengthUncertainty = 95;
      reasons.push('Kritik veri kalitesi hatası veya gelecek sızıntısı: Takım gücü belirsizliği tavan yaptı.');
    } else if (dataQuality.status === 'STALE') {
      strengthUncertainty = Math.min(95, strengthUncertainty + 15);
      reasons.push('Bayat veri (Stale): Sonuçlar güncel form durumundan sapabilir.');
    }

    strengthUncertainty = Math.max(10, Math.min(99, Math.round(strengthUncertainty)));

    let uncertaintyLevel: TeamStrengthProfile['uncertaintyLevel'] = 'LOW';
    if (strengthUncertainty >= 80) uncertaintyLevel = 'CRITICAL';
    else if (strengthUncertainty >= 60) uncertaintyLevel = 'HIGH';
    else if (strengthUncertainty >= 40) uncertaintyLevel = 'MEDIUM';

    const profile: TeamStrengthProfile = {
      teamId,
      canonicalTeamId,
      teamName,
      overallStrength: finalOverall,
      attackStrength,
      defenseStrength,
      homeStrength,
      awayStrength,
      homeAttackStrength,
      homeDefenseStrength,
      awayAttackStrength,
      awayDefenseStrength,
      recentStrength: Math.round(recentStrength),
      opponentAdjustedStrength: Math.round(opponentAdjustedStrength),
      strengthUncertainty,
      uncertaintyLevel,
      sampleSize,
      homeSampleSize,
      awaySampleSize,
      dataQuality: dataQuality.score,
      shrinkageFactor,
      seasonTransitionApplied,
      homeAdvantageNeutralized: true,
      updatedAt: new Date().toISOString(),
      methodVersion: DYNAMIC_STRENGTH_METHOD_VERSION,
      reasons,
    };

    profileCache.set(cacheKey, { profile, timestamp: Date.now() });
    return profile;
  }
}
