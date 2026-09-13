// src/analysis/squadImpact.ts - Squad & Player Impact v2.0 Engine
// Strict zero-trust mathematical model for verified squad and lineup impact evaluation.
import {
  CanonicalMatch,
  CanonicalMatchSquadData,
  CanonicalTeamSquad,
  CanonicalPlayer,
  PlayerImpactItem,
  TeamSquadImpact,
  MatchSquadImpact,
  DataQualityReport,
  DataQualityStatus,
  MatchTeamStrength,
  MatchOpponentAdjustedForm,
  MatchAdvancedXG,
} from '@/types';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';

export interface SquadEvaluationInput {
  match: CanonicalMatch;
  squadData?: CanonicalMatchSquadData;
  teamStrength?: MatchTeamStrength;
  opponentAdjustedForm?: MatchOpponentAdjustedForm;
  advancedXG?: MatchAdvancedXG;
  dataQuality?: DataQualityReport;
  analysisTime?: number;
}

export class SquadImpactEngine {
  public static readonly VERSION = 'SQUAD_PLAYER_IMPACT_v2.0';

  /**
   * Generates deterministic 32-bit FNV-1a hash from string inputs without external dependencies or Math.random()
   */
  public static computeDeterministicHash(str: string): string {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Computes a deterministic squad snapshot ID
   */
  public static computeSquadSnapshotId(
    fixtureId: string | number,
    homeTeamId: string | number,
    awayTeamId: string | number,
    version: string,
    squadIdentity: string
  ): string {
    const raw = `${fixtureId}:${homeTeamId}:${awayTeamId}:${version}:${squadIdentity}`;
    const hash = this.computeDeterministicHash(raw);
    return `sqsnap_${fixtureId}_${hash}`;
  }

  /**
   * Evaluates match squad impact with strict zero-trust, double-counting protection,
   * Bayesian shrinkage, and future leakage guards.
   */
  public static evaluateMatch(input: SquadEvaluationInput): MatchSquadImpact {
    const { match, squadData, teamStrength, opponentAdjustedForm, advancedXG, dataQuality } = input;
    const now = input.analysisTime || Date.now();
    const kickoffTime = new Date(match.utcDate).getTime();

    // 0. Deterministic Squad Snapshot ID Generation
    const squadIdentity = squadData
      ? `${squadData.retrievedAt || 'squad'}_${squadData.isConfirmed ? 'CONFIRMED' : 'EXPECTED'}_H${squadData.home?.startingXI?.length || 0}_A${squadData.away?.startingXI?.length || 0}`
      : 'UNAVAILABLE';

    const squadSnapshotId = this.computeSquadSnapshotId(
      match.id,
      match.homeTeam.id || match.homeTeam.name,
      match.awayTeam.id || match.awayTeam.name,
      this.VERSION,
      squadIdentity
    );

    // 1. Future Leakage Verification
    const isLeakageDetected =
      (squadData?.retrievedAt && new Date(squadData.retrievedAt).getTime() > now + 60 * 1000) ||
      (now > kickoffTime && Boolean(squadData?.retrievedAt && new Date(squadData.retrievedAt).getTime() > kickoffTime + 2 * 3600 * 1000));

    const futureLeakageGuard = {
      evaluationTimestamp: new Date(now).toISOString(),
      fixtureKickoff: match.utcDate,
      passed: !isLeakageDetected,
    };

    if (isLeakageDetected) {
      return this.createAbstainedResult(
        match,
        'INVALID',
        'FUTURE_DATA_LEAKAGE: Kadro veri zaman damgası geleceğe ait veya maç sonrasına ait veri içeriyor.',
        futureLeakageGuard,
        0,
        100,
        squadSnapshotId
      );
    }

    // 2. Canonical Squad Verification Check
    const em = CanonicalEntityManager.getInstance();
    const bindingCheck = em.verifySquadBinding(match, squadData);

    if (!squadData || !bindingCheck.isValid) {
      const reason = !squadData
        ? 'Gerçek ve doğrulanmış kadro/oyuncu verisi mevcut değil (Sıfır-Uydurma Veri Kuralı).'
        : bindingCheck.diagnosticMessage;

      const status: DataQualityStatus = !squadData
        ? 'MISSING'
        : bindingCheck.reasonCode === 'FUTURE_DATA_LEAKAGE' || bindingCheck.reasonCode === 'AMBIGUOUS_PLAYER_IDENTITY'
        ? 'INVALID'
        : 'LOW_CONFIDENCE';

      return this.createAbstainedResult(
        match,
        status,
        reason,
        futureLeakageGuard,
        !squadData ? 0 : 20,
        90,
        squadSnapshotId
      );
    }

    // 3. Lineup Confirmation & Lineup Type
    const isConfirmed = Boolean(squadData.isConfirmed && squadData.home.isConfirmed && squadData.away.isConfirmed);
    const lineupType = isConfirmed ? 'CONFIRMED' : 'EXPECTED';

    // 4. Evaluate Home & Away Squad Impacts
    const homeImpact = this.evaluateTeamSquad({
      squad: squadData.home,
      isHome: true,
      teamName: match.homeTeam.name,
      canonicalTeamId: bindingCheck.homeTeamCanonicalId,
      isConfirmed: Boolean(squadData.home.isConfirmed),
      teamStrength: teamStrength?.home,
      opponentAdjustedForm: opponentAdjustedForm?.home,
      advancedXG: advancedXG?.home,
      dataQualityStatus: dataQuality?.status || 'AVAILABLE',
    });

    const awayImpact = this.evaluateTeamSquad({
      squad: squadData.away,
      isHome: false,
      teamName: match.awayTeam.name,
      canonicalTeamId: bindingCheck.awayTeamCanonicalId,
      isConfirmed: Boolean(squadData.away.isConfirmed),
      teamStrength: teamStrength?.away,
      opponentAdjustedForm: opponentAdjustedForm?.away,
      advancedXG: advancedXG?.away,
      dataQualityStatus: dataQuality?.status || 'AVAILABLE',
    });

    // 5. Net Relative Advantage (-50 to +50 scale)
    const relativeSquadAdvantage = Math.round(
      (homeImpact.netSquadImpactScore - awayImpact.netSquadImpactScore) * 10
    ) / 10;

    // 6. Overall Match Squad Uncertainty & Quality
    const matchUncertainty = Math.round((homeImpact.uncertainty + awayImpact.uncertainty) / 2);
    const matchQuality = Math.min(
      dataQuality?.score ?? 100,
      isConfirmed ? 95 : 75
    );

    // 7. Abstention Evaluation (If uncertainty is too high or data quality is depleted)
    const shouldAbstain = matchUncertainty >= 80 || (homeImpact.impactLevel === 'UNKNOWN' && awayImpact.impactLevel === 'UNKNOWN');

    // 8. Summary Generation
    const summary = this.generateSummary(homeImpact, awayImpact, relativeSquadAdvantage, isConfirmed);

    return {
      squadSnapshotId,
      status: isConfirmed ? 'AVAILABLE' : 'PARTIAL',
      isAvailable: true,
      isConfirmed,
      lineupType,
      home: homeImpact,
      away: awayImpact,
      relativeSquadAdvantage,
      doubleCountingGuards: {
        dtsIsolated: true,
        oafIsolated: true,
        xgIsolated: true,
        eloProtected: true,
        probabilityDirectlyManipulated: false,
      },
      futureLeakageGuard,
      dataQuality: matchQuality,
      uncertainty: matchUncertainty,
      methodVersion: this.VERSION,
      abstention: {
        isAbstained: shouldAbstain,
        reason: shouldAbstain ? 'Kadro belirsizliği çok yüksek; model maç olasılıklarını doğrudan etkilemekten kaçındı (Abstain).' : undefined,
      },
      summary,
    };
  }

  /**
   * Evaluates individual team squad
   */
  private static evaluateTeamSquad(params: {
    squad: CanonicalTeamSquad;
    isHome: boolean;
    teamName: string;
    canonicalTeamId: string;
    isConfirmed: boolean;
    teamStrength?: any;
    opponentAdjustedForm?: any;
    advancedXG?: any;
    dataQualityStatus: DataQualityStatus;
  }): TeamSquadImpact {
    const { squad, teamName, canonicalTeamId, isConfirmed, opponentAdjustedForm } = params;

    const startingXI = squad.startingXI || [];
    const bench = squad.bench || [];
    const absences = squad.injuriesAndAbsences || [];

    const evaluatedPlayers: PlayerImpactItem[] = [];
    const reasons: string[] = [];

    // Track position metrics
    let activeGKs = 0;
    let activeDefs = 0;
    let activeMids = 0;
    let activeAtts = 0;

    let doubtfulCount = 0;
    let missingCount = 0;
    let keyMissingCount = 0;

    // A. Evaluate starting XI
    for (const player of startingXI) {
      const expMinutes = this.computeExpectedMinutes(player, isConfirmed, true);
      const isKey = this.isKeyPlayer(player);
      const shrinkage = this.computeShrinkage(player.seasonAppearances || player.seasonMinutes ? Math.floor((player.seasonMinutes || 0) / 90) : 0);

      const impactItem: PlayerImpactItem = {
        player,
        role: player.position,
        availabilityStatus: player.status || (isConfirmed ? 'STARTING_CONFIRMED' : 'STARTING_EXPECTED'),
        expectedMinutes: expMinutes,
        availabilityProbability: isConfirmed ? 1.0 : 0.85,
        sampleSize: player.seasonAppearances || 0,
        shrinkageFactor: shrinkage,
        impactScore: Math.round((isKey ? 3.0 : 1.0) * shrinkage * 10) / 10,
        impactConfidence: isConfirmed ? 90 : 70,
        impactUncertainty: isConfirmed ? 15 : 35,
        isKeyPlayer: isKey,
        replacementCoverage: 'STRONG',
        explanation: `${player.name} (${player.position}) - İlk 11 (${isConfirmed ? 'Resmi' : 'Beklenen'}, ~${expMinutes} dk).`,
        dataQuality: 'AVAILABLE',
      };
      evaluatedPlayers.push(impactItem);

      if (player.position === 'GK') activeGKs++;
      else if (player.position === 'DEF') activeDefs++;
      else if (player.position === 'MID') activeMids++;
      else if (player.position === 'ATT') activeAtts++;
    }

    // B. Evaluate bench
    for (const player of bench) {
      const expMinutes = this.computeExpectedMinutes(player, isConfirmed, false);
      const isKey = this.isKeyPlayer(player);
      const shrinkage = this.computeShrinkage(player.seasonAppearances || 0);

      evaluatedPlayers.push({
        player,
        role: player.position,
        availabilityStatus: player.status || 'BENCH_EXPECTED',
        expectedMinutes: expMinutes,
        availabilityProbability: 0.5,
        sampleSize: player.seasonAppearances || 0,
        shrinkageFactor: shrinkage,
        impactScore: 0.5 * shrinkage,
        impactConfidence: 75,
        impactUncertainty: 25,
        isKeyPlayer: isKey,
        replacementCoverage: 'ADEQUATE',
        explanation: `${player.name} (${player.position}) - Yedek kulübesi (~${expMinutes} dk).`,
        dataQuality: 'AVAILABLE',
      });
    }

    // C. Evaluate absences and injuries
    for (const player of absences) {
      const isKey = this.isKeyPlayer(player);
      const shrinkage = this.computeShrinkage(player.seasonAppearances || 0);

      if (player.status === 'DOUBTFUL') {
        doubtfulCount++;
      } else {
        missingCount++;
        if (isKey) keyMissingCount++;
      }

      // OAF Double-counting attenuation:
      // If player has been absent for extensive duration, OAF already caught this weakness.
      let oafDampener = 1.0;
      if (opponentAdjustedForm && opponentAdjustedForm.sampleSize >= 5 && (player.seasonAppearances || 0) < 3) {
        oafDampener = 0.5; // Half penalty since recent form already reflects playing without this player
      }

      // Bounded negative score for absence
      const baseNegative = isKey ? -4.0 : -1.5;
      const penaltyScore = Math.round(baseNegative * shrinkage * oafDampener * 10) / 10;

      const reasonDesc = player.suspensionReason
        ? `Cezalı (${player.suspensionReason})`
        : player.injuryReason
        ? `Sakat (${player.injuryReason})`
        : 'Kadro dışı / Eksik';

      evaluatedPlayers.push({
        player,
        role: player.position,
        availabilityStatus: player.status || 'UNAVAILABLE',
        expectedMinutes: 0,
        availabilityProbability: 0,
        sampleSize: player.seasonAppearances || 0,
        shrinkageFactor: shrinkage,
        impactScore: penaltyScore,
        impactConfidence: 85,
        impactUncertainty: 20,
        isKeyPlayer: isKey,
        replacementCoverage: 'DEPLETED',
        explanation: `${player.name} (${player.position}) - ${reasonDesc}${oafDampener < 1 ? ' [OAF çifte sayım yalıtımı uygulandı]' : ''}.`,
        dataQuality: 'AVAILABLE',
      });
    }

    // D. Goalkeeper status evaluation
    let gkStatus: TeamSquadImpact['goalkeeperStatus'] = {
      status: activeGKs > 0 ? (isConfirmed ? 'STARTING_CONFIRMED' : 'STARTING_EXPECTED') : 'UNKNOWN',
      impactScore: 0,
      confidence: 80,
      uncertainty: 20,
      details: 'Kaleci pozisyonu dengeli.',
    };

    const missingGK = absences.find((p) => p.position === 'GK' && this.isKeyPlayer(p));
    if (missingGK) {
      gkStatus = {
        status: 'BACKUP',
        impactScore: -3.5,
        confidence: 85,
        uncertainty: 30,
        details: `As kaleci eksik (${missingGK.name}). Yedek kaleci devrede.`,
      };
      reasons.push(gkStatus.details);
    } else if (activeGKs === 0) {
      gkStatus = {
        status: 'UNKNOWN',
        impactScore: 0,
        confidence: 30,
        uncertainty: 80,
        details: 'Kaleci bilgisi net değil.',
      };
    }

    // E. Defensive coverage evaluation
    let defRating: 'SOLID' | 'ADEQUATE' | 'DEPLETED' | 'UNKNOWN' = 'ADEQUATE';
    let defScore = 0;
    const missingDefs = absences.filter((p) => p.position === 'DEF');

    if (activeDefs >= 4 && missingDefs.length === 0) {
      defRating = 'SOLID';
      defScore = 2.0;
    } else if (missingDefs.some((p) => this.isKeyPlayer(p))) {
      defRating = 'DEPLETED';
      defScore = -Math.min(6.0, missingDefs.length * 2.0);
      reasons.push(`Savunmada ${missingDefs.length} eksik (${missingDefs.map((p) => p.name).join(', ')}).`);
    } else if (activeDefs < 3 && startingXI.length > 0) {
      defRating = 'DEPLETED';
      defScore = -3.0;
    }

    // F. Attacking coverage evaluation
    let attRating: 'FULL_STRENGTH' | 'ADEQUATE' | 'DEPLETED' | 'UNKNOWN' = 'ADEQUATE';
    let attScore = 0;
    const missingAtts = absences.filter((p) => p.position === 'ATT' || p.position === 'MID');
    const keyMissingAtts = missingAtts.filter((p) => this.isKeyPlayer(p));

    if (keyMissingAtts.length > 0) {
      attRating = 'DEPLETED';
      attScore = -Math.min(7.0, keyMissingAtts.length * 2.5);
      reasons.push(`Hücumda kilit eksik: ${keyMissingAtts.map((p) => p.name).join(', ')}.`);
    } else if (activeAtts >= 2 && activeMids >= 3) {
      attRating = 'FULL_STRENGTH';
      attScore = 2.0;
    }

    // G. Squad Depth Assessment
    let depthAssessment: 'STRONG' | 'ADEQUATE' | 'LIMITED' | 'UNKNOWN' = 'ADEQUATE';
    if (bench.length >= 7 && absences.length <= 1) {
      depthAssessment = 'STRONG';
    } else if (absences.length >= 4 || bench.length < 5) {
      depthAssessment = 'LIMITED';
      reasons.push('Kadro derinliği sınırlı, rotasyon kapasitesi daraldı.');
    }

    // H. Multiple Absences Non-linear Interaction Penalty
    // Bounded between -8 and 0 (never unbounded linear crash)
    let multiplePenalty = 0;
    if (missingCount >= 2) {
      multiplePenalty = -Math.min(8.0, Math.round((missingCount - 1) * 1.5 * 10) / 10);
      reasons.push(`Çoklu eksiklik etkileşimi: ${multiplePenalty} puanlık derinlik cezası.`);
    }

    // I. Net Squad Impact Score (-50 to +50 bounded scale)
    const rawNetScore = gkStatus.impactScore + defScore + attScore + multiplePenalty;
    const netSquadImpactScore = Math.max(-50, Math.min(50, Math.round(rawNetScore * 10) / 10));

    // J. Impact Level Classification
    let impactLevel: TeamSquadImpact['impactLevel'] = 'NEUTRAL';
    if (netSquadImpactScore >= 5) impactLevel = 'HIGH_POSITIVE';
    else if (netSquadImpactScore >= 2) impactLevel = 'POSITIVE';
    else if (netSquadImpactScore <= -8) impactLevel = 'CRITICAL_NEGATIVE';
    else if (netSquadImpactScore <= -3) impactLevel = 'NEGATIVE';

    // K. Uncertainty Calculation
    let teamUncertainty = isConfirmed ? 20 : 45;
    if (!isConfirmed) teamUncertainty += 15;
    if (doubtfulCount > 0) teamUncertainty += doubtfulCount * 8;
    if (startingXI.length === 0) teamUncertainty = 90;
    teamUncertainty = Math.min(95, teamUncertainty);

    const teamConfidence = Math.max(10, 100 - teamUncertainty);

    return {
      canonicalTeamId,
      teamName,
      lineupStatus: isConfirmed ? 'CONFIRMED' : startingXI.length > 0 ? 'EXPECTED' : 'UNAVAILABLE',
      availableCount: startingXI.length + bench.length,
      doubtfulCount,
      missingCount,
      keyMissingCount,
      goalkeeperStatus: gkStatus,
      defensiveCoverage: {
        rating: defRating,
        activeDefendersCount: activeDefs,
        impactScore: defScore,
      },
      attackingCoverage: {
        rating: attRating,
        activeAttackersCount: activeAtts,
        impactScore: attScore,
      },
      depthAssessment,
      multipleAbsencesInteractionPenalty: multiplePenalty,
      netSquadImpactScore,
      impactLevel,
      confidence: teamConfidence,
      uncertainty: teamUncertainty,
      dataQuality: isConfirmed ? 'AVAILABLE' : 'PARTIAL',
      players: evaluatedPlayers,
      reasons,
    };
  }

  /**
   * Computes expected minutes with zero-trust validation
   */
  private static computeExpectedMinutes(
    player: CanonicalPlayer,
    isConfirmedLineup: boolean,
    isStartingXI: boolean
  ): number {
    if (player.status === 'INJURED' || player.status === 'SUSPENDED' || player.status === 'UNAVAILABLE') {
      return 0;
    }
    if (player.status === 'UNKNOWN') {
      return 0;
    }
    if (player.status === 'DOUBTFUL') {
      return 25;
    }
    if (isStartingXI) {
      if (isConfirmedLineup || player.status === 'STARTING_CONFIRMED') {
        return player.position === 'GK' ? 90 : 80;
      }
      return 65; // Expected starter with higher uncertainty
    }
    // Bench player
    return 15;
  }

  /**
   * Determines if player is a verified key contributor without guessing
   */
  private static isKeyPlayer(player: CanonicalPlayer): boolean {
    if (player.isCaptain) return true;
    if ((player.seasonAppearances || 0) >= 12) return true;
    if ((player.goals || 0) >= 4 || (player.assists || 0) >= 4) return true;
    if ((player.cleanSheets || 0) >= 4 && player.position === 'GK') return true;
    if (player.isStarter && (player.seasonMinutes || 0) > 800) return true;
    return false;
  }

  /**
   * Bayesian shrinkage factor toward baseline 0 (0.0 = full shrink to 0, 1.0 = full weight)
   */
  private static computeShrinkage(sampleSize: number): number {
    const priorWeight = 8.0;
    return Math.round((sampleSize / (sampleSize + priorWeight)) * 100) / 100;
  }

  /**
   * Helper to build abstained / missing squad impact
   */
  private static createAbstainedResult(
    match: CanonicalMatch,
    status: DataQualityStatus,
    reason: string,
    futureLeakageGuard: MatchSquadImpact['futureLeakageGuard'],
    quality: number,
    uncertainty: number,
    squadSnapshotId?: string
  ): MatchSquadImpact {
    const calculatedSnapshotId =
      squadSnapshotId ||
      this.computeSquadSnapshotId(
        match.id,
        match.homeTeam.id || match.homeTeam.name,
        match.awayTeam.id || match.awayTeam.name,
        this.VERSION,
        'UNAVAILABLE'
      );

    const emptyTeamImpact = (teamName: string, canonicalTeamId: string): TeamSquadImpact => ({
      canonicalTeamId,
      teamName,
      lineupStatus: 'UNAVAILABLE',
      availableCount: 0,
      doubtfulCount: 0,
      missingCount: 0,
      keyMissingCount: 0,
      goalkeeperStatus: {
        status: 'UNKNOWN',
        impactScore: 0,
        confidence: 0,
        uncertainty: 100,
        details: 'Kadro bilgisi bulunmuyor.',
      },
      defensiveCoverage: {
        rating: 'UNKNOWN',
        activeDefendersCount: 0,
        impactScore: 0,
      },
      attackingCoverage: {
        rating: 'UNKNOWN',
        activeAttackersCount: 0,
        impactScore: 0,
      },
      depthAssessment: 'UNKNOWN',
      multipleAbsencesInteractionPenalty: 0,
      netSquadImpactScore: 0,
      impactLevel: 'UNKNOWN',
      confidence: 0,
      uncertainty: 100,
      dataQuality: status,
      players: [],
      reasons: [reason],
    });

    return {
      squadSnapshotId: calculatedSnapshotId,
      status,
      isAvailable: false,
      isConfirmed: false,
      lineupType: 'UNAVAILABLE',
      home: emptyTeamImpact(match.homeTeam.name, match.homeTeam.id ? String(match.homeTeam.id) : ''),
      away: emptyTeamImpact(match.awayTeam.name, match.awayTeam.id ? String(match.awayTeam.id) : ''),
      relativeSquadAdvantage: 0,
      doubleCountingGuards: {
        dtsIsolated: true,
        oafIsolated: true,
        xgIsolated: true,
        eloProtected: true,
        probabilityDirectlyManipulated: false,
      },
      futureLeakageGuard,
      dataQuality: quality,
      uncertainty,
      methodVersion: this.VERSION,
      abstention: {
        isAbstained: true,
        reason,
      },
      summary: `Kadro ve oyuncu etkisi hesaplanamadı: ${reason}`,
    };
  }

  /**
   * Generates analytical summary in Turkish
   */
  private static generateSummary(
    home: TeamSquadImpact,
    away: TeamSquadImpact,
    relativeAdvantage: number,
    isConfirmed: boolean
  ): string {
    const lineupTxt = isConfirmed ? 'Resmi ilk 11' : 'Beklenen kadro';
    if (home.missingCount === 0 && away.missingCount === 0) {
      return `${lineupTxt} verilerine göre her iki takım da tam kadro sahada; kadro etkisi dengeli.`;
    }

    if (relativeAdvantage > 3) {
      return `${lineupTxt} analizi: ${home.teamName}, ${away.teamName} karşısında kadro derinliği ve eksikler bazında avantajlı (+${relativeAdvantage} net puan).`;
    }
    if (relativeAdvantage < -3) {
      return `${lineupTxt} analizi: ${away.teamName}, ${home.teamName} karşısında kadro istikrarı ve daha az eksikle öne çıkıyor (${relativeAdvantage} net puan).`;
    }
    return `${lineupTxt} analizi: Eksikler ve kadro derinlikleri birbirini dengeliyor (${relativeAdvantage} net fark).`;
  }
}
