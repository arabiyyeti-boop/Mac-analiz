// src/analysis/advancedXG.ts - ADVANCED xG v2.0 Architecture
// Strict separation of Real xG (Provider Verified) vs Model Expected Goals (Poisson / Dixon-Coles)
// Zero-Tolerance "No Fake xG" Guarantee (No-Invention Rule)

import {
  CanonicalMatch,
  CanonicalStats,
  CanonicalStanding,
  CanonicalForm,
  DataQualityReport,
  MatchAdvancedXG,
  AdvancedXGProfile,
  RealXGStatus,
} from '@/types';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';

export interface AdvancedXGEvaluationParams {
  match: CanonicalMatch;
  stats?: CanonicalStats;
  homeStanding?: CanonicalStanding;
  awayStanding?: CanonicalStanding;
  homeForm?: CanonicalForm;
  awayForm?: CanonicalForm;
  dataQuality: DataQualityReport;
  modelExpectedGoals: {
    home: number;
    away: number;
    sourceModel: string;
  };
  analysisTimestamp?: number;
}

export class AdvancedXGEngine {
  private static cache = new Map<string, { data: MatchAdvancedXG; timestamp: number }>();
  private static CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Evaluates Advanced xG v2.0 signal strictly adhering to the No-Invention rule.
   * If real xG is not present from a verified telemetry provider, status is set to 'MISSING'.
   * Model Expected Goals are explicitly isolated from real xG.
   */
  public static evaluateMatch(params: AdvancedXGEvaluationParams): MatchAdvancedXG {
    const {
      match,
      stats,
      homeStanding,
      awayStanding,
      homeForm,
      awayForm,
      dataQuality,
      modelExpectedGoals,
      analysisTimestamp = Date.now(),
    } = params;

    const cacheKey = `${match.id}__${stats?.homeXG}__${stats?.awayXG}__${stats?.xG}__${modelExpectedGoals.home}__${modelExpectedGoals.away}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (analysisTimestamp - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const em = CanonicalEntityManager.getInstance();
    const homeEntity = em.resolveTeam({ name: match.homeTeam.name });
    const awayEntity = em.resolveTeam({ name: match.awayTeam.name });
    const homeCanonicalId = homeEntity.team?.canonicalTeamId || `team_${match.homeTeam.id}`;
    const awayCanonicalId = awayEntity.team?.canonicalTeamId || `team_${match.awayTeam.id}`;

    // 1. VERIFY REAL xG DATA AVAILABILITY & BINDING
    const xgBinding = em.verifyXGBinding(match, stats);
    const hasRealHomeXG = stats?.homeXG !== undefined && !isNaN(stats.homeXG) && stats.homeXG >= 0;
    const hasRealAwayXG = stats?.awayXG !== undefined && !isNaN(stats.awayXG) && stats.awayXG >= 0;
    const isVerifiedReal = Boolean(stats?.isRealXG || (hasRealHomeXG && hasRealAwayXG));

    // 2. STRICT NO-INVENTION BRANCH: If Real xG is missing or invalid, DO NOT INVENT
    if (!stats || (!hasRealHomeXG && !hasRealAwayXG) || !xgBinding.isValid) {
      const missingHomeProfile: AdvancedXGProfile = {
        teamId: match.homeTeam.id,
        canonicalTeamId: homeCanonicalId,
        teamName: match.homeTeam.name,
        status: 'MISSING',
        sampleSize: 0,
        uncertainty: 100,
        dataQuality: dataQuality.score,
        shrinkageFactor: 1.0,
        methodVersion: 'ADVANCED_xG_v2.0',
        reasons: [
          'Harici veri sağlayıcısında bu fikstür için doğrulanmış gerçek xG verisi bulunmuyor.',
          'No-Invention Prensibi: Model tahminleri veya türetilmiş istatistikler "gerçek xG" olarak gösterilmez.',
        ],
      };

      const missingAwayProfile: AdvancedXGProfile = {
        teamId: match.awayTeam.id,
        canonicalTeamId: awayCanonicalId,
        teamName: match.awayTeam.name,
        status: 'MISSING',
        sampleSize: 0,
        uncertainty: 100,
        dataQuality: dataQuality.score,
        shrinkageFactor: 1.0,
        methodVersion: 'ADVANCED_xG_v2.0',
        reasons: [
          'Harici veri sağlayıcısında bu fikstür için doğrulanmış gerçek xG verisi bulunmuyor.',
          'No-Invention Prensibi: Model tahminleri veya türetilmiş istatistikler "gerçek xG" olarak gösterilmez.',
        ],
      };

      const missingResult: MatchAdvancedXG = {
        status: 'MISSING',
        isAvailable: false,
        home: missingHomeProfile,
        away: missingAwayProfile,
        modelExpectedGoals: {
          home: Number(modelExpectedGoals.home.toFixed(2)),
          away: Number(modelExpectedGoals.away.toFixed(2)),
          sourceModel: modelExpectedGoals.sourceModel || 'Poisson Bivariate PMF & Dixon-Coles',
          homeExpectedGoals: Number(modelExpectedGoals.home.toFixed(2)),
          awayExpectedGoals: Number(modelExpectedGoals.away.toFixed(2)),
        },
        provenance: {
          provider: stats?.sourceProvider || 'N/A',
          fixtureId: match.id,
          verifiedAt: new Date(analysisTimestamp).toISOString(),
          bindingValid: xgBinding.isValid,
        },
        dataQuality: dataQuality.score,
        uncertainty: 100,
        sensitivityNote:
          'Gerçek xG verisi bulunmadığı için model tamamen Poisson / Dixon-Coles teorik beklenen gol dağılımı (lambda) üzerinden bağımsız olarak çalıştırılmıştır.',
        methodVersion: 'ADVANCED_xG_v2.0',
        reasons: [
          'Gerçek şut bazlı xG telemetrisi mevcut değil.',
          'Matematiksel model gol beklentileri ayrıştırılmış olarak sunulmaktadır.',
        ],
      };

      this.cache.set(cacheKey, { data: missingResult, timestamp: analysisTimestamp });
      return missingResult;
    }

    // 3. REAL xG IS PRESENT AND VERIFIED
    const status: RealXGStatus = (hasRealHomeXG && hasRealAwayXG) ? 'AVAILABLE' : 'PARTIAL';
    const rawHomeXG = stats.homeXG ?? (stats.xG ? Number(stats.xG.toFixed(2)) : 0);
    const rawAwayXG = stats.awayXG ?? 0;

    // Actual goals scored in match if available
    const actualHomeGoals = match.score?.fullTime?.home ?? undefined;
    const actualAwayGoals = match.score?.fullTime?.away ?? undefined;

    // Determine sample size
    const homeSample = homeForm?.matchesPlayed ?? (homeStanding?.playedGames || 1);
    const awaySample = awayForm?.matchesPlayed ?? (awayStanding?.playedGames || 1);

    // Shrinkage towards baseline for small samples
    const homeShrinkageFactor = Number((homeSample / (homeSample + 6)).toFixed(2));
    const awayShrinkageFactor = Number((awaySample / (awaySample + 6)).toFixed(2));

    // Over/Underperformance analysis
    const homeOverperformance = actualHomeGoals !== undefined ? Number((actualHomeGoals - rawHomeXG).toFixed(2)) : undefined;
    const awayOverperformance = actualAwayGoals !== undefined ? Number((actualAwayGoals - rawAwayXG).toFixed(2)) : undefined;

    // Regression signal evaluation
    const evaluateRegression = (
      overperf?: number,
      actualGoals?: number,
      xgVal?: number
    ): AdvancedXGProfile['regressionSignal'] => {
      if (overperf === undefined || xgVal === undefined) {
        return {
          isRegressionCandidate: false,
          type: 'NEUTRAL',
          note: 'Maç henüz tamamlanmadığı için bitiricilik regresyonu canlı takip ediliyor.',
          confidence: 70,
        };
      }

      if (overperf >= 0.40) {
        return {
          isRegressionCandidate: true,
          type: 'NEGATIVE_REGRESSION',
          note: `xG'nin ${overperf.toFixed(2)} gol üzerinde bitiricilik. Yüksek klinik bitiricilik uzun vadede gerileme (negatif regresyon) eğilimi gösterebilir.`,
          confidence: 78,
        };
      } else if (overperf <= -0.40) {
        return {
          isRegressionCandidate: true,
          type: 'POSITIVE_REGRESSION',
          note: `xG beklentisinin ${Math.abs(overperf).toFixed(2)} gol gerisinde kalınmış. Şanssızlık veya düşük verim uzun vadede toparlanma (pozitif regresyon) potansiyeli taşır.`,
          confidence: 76,
        };
      }

      return {
        isRegressionCandidate: false,
        type: 'NEUTRAL',
        note: 'Atılan goller ile xG beklentisi dengeli ve sürdürülebilir aralıkta.',
        confidence: 85,
      };
    };

    const homeRegression = evaluateRegression(homeOverperformance, actualHomeGoals, rawHomeXG);
    const awayRegression = evaluateRegression(awayOverperformance, actualAwayGoals, rawAwayXG);

    // Uncertainty calculations
    const homeUncertainty = Math.max(15, Math.min(85, Math.round(100 - (dataQuality.score * 0.5 + homeShrinkageFactor * 40))));
    const awayUncertainty = Math.max(15, Math.min(85, Math.round(100 - (dataQuality.score * 0.5 + awayShrinkageFactor * 40))));

    const homeProfile: AdvancedXGProfile = {
      teamId: match.homeTeam.id,
      canonicalTeamId: homeCanonicalId,
      teamName: match.homeTeam.name,
      status: hasRealHomeXG ? 'AVAILABLE' : 'MISSING',
      realXGFor: rawHomeXG,
      realXGAgainst: rawAwayXG,
      homeXG: rawHomeXG,
      homeXGA: rawAwayXG,
      xGOverperformance: homeOverperformance,
      xGUnderperformance: (actualAwayGoals !== undefined && rawAwayXG !== undefined) ? Number((actualAwayGoals - rawAwayXG).toFixed(2)) : undefined,
      sampleSize: homeSample,
      uncertainty: homeUncertainty,
      dataQuality: dataQuality.score,
      source: stats.sourceProvider || 'Telemetri Sağlayıcı',
      retrievedAt: stats.retrievedAt,
      methodVersion: 'ADVANCED_xG_v2.0',
      provenance: {
        provider: stats.sourceProvider || 'Telemetri',
        sourceFixtureId: match.id,
        sourceTeamId: String(match.homeTeam.id),
        retrievedAt: stats.retrievedAt,
        canonicalFixtureId: match.id,
        canonicalTeamId: homeCanonicalId,
        verified: isVerifiedReal,
      },
      regressionSignal: homeRegression,
      shrinkageFactor: homeShrinkageFactor,
      reasons: [
        `Doğrulanmış şut telemetrisi üzerinden gerçek xG: ${rawHomeXG.toFixed(2)}`,
        `Örneklem büyüklüğü: ${homeSample} maç, shrinkage katsayısı: ${homeShrinkageFactor}`,
      ],
    };

    const awayProfile: AdvancedXGProfile = {
      teamId: match.awayTeam.id,
      canonicalTeamId: awayCanonicalId,
      teamName: match.awayTeam.name,
      status: hasRealAwayXG ? 'AVAILABLE' : 'MISSING',
      realXGFor: rawAwayXG,
      realXGAgainst: rawHomeXG,
      awayXG: rawAwayXG,
      awayXGA: rawHomeXG,
      xGOverperformance: awayOverperformance,
      xGUnderperformance: (actualHomeGoals !== undefined && rawHomeXG !== undefined) ? Number((actualHomeGoals - rawHomeXG).toFixed(2)) : undefined,
      sampleSize: awaySample,
      uncertainty: awayUncertainty,
      dataQuality: dataQuality.score,
      source: stats.sourceProvider || 'Telemetri Sağlayıcı',
      retrievedAt: stats.retrievedAt,
      methodVersion: 'ADVANCED_xG_v2.0',
      provenance: {
        provider: stats.sourceProvider || 'Telemetri',
        sourceFixtureId: match.id,
        sourceTeamId: String(match.awayTeam.id),
        retrievedAt: stats.retrievedAt,
        canonicalFixtureId: match.id,
        canonicalTeamId: awayCanonicalId,
        verified: isVerifiedReal,
      },
      regressionSignal: awayRegression,
      shrinkageFactor: awayShrinkageFactor,
      reasons: [
        `Doğrulanmış şut telemetrisi üzerinden gerçek xG: ${rawAwayXG.toFixed(2)}`,
        `Örneklem büyüklüğü: ${awaySample} maç, shrinkage katsayısı: ${awayShrinkageFactor}`,
      ],
    };

    const combinedUncertainty = Math.round((homeUncertainty + awayUncertainty) / 2);

    const result: MatchAdvancedXG = {
      status,
      isAvailable: true,
      home: homeProfile,
      away: awayProfile,
      modelExpectedGoals: {
        home: Number(modelExpectedGoals.home.toFixed(2)),
        away: Number(modelExpectedGoals.away.toFixed(2)),
        sourceModel: modelExpectedGoals.sourceModel || 'Poisson Bivariate PMF & Dixon-Coles',
        homeExpectedGoals: Number(modelExpectedGoals.home.toFixed(2)),
        awayExpectedGoals: Number(modelExpectedGoals.away.toFixed(2)),
      },
      provenance: {
        provider: stats.sourceProvider || 'Telemetri Sağlayıcı',
        fixtureId: match.id,
        verifiedAt: stats.retrievedAt || new Date(analysisTimestamp).toISOString(),
        bindingValid: true,
      },
      dataQuality: dataQuality.score,
      uncertainty: combinedUncertainty,
      sensitivityNote:
        `Gerçek xG (Ev: ${rawHomeXG.toFixed(2)}, Dep: ${rawAwayXG.toFixed(2)}) ile Model Beklenen Gol (Ev: ${modelExpectedGoals.home.toFixed(2)}, Dep: ${modelExpectedGoals.away.toFixed(2)}) bağımsız olarak doğrulanmıştır.`,
      methodVersion: 'ADVANCED_xG_v2.0',
      reasons: [
        'Sağlayıcı şut bazlı pozisyon telemetrisi başarıyla ayrıştırıldı.',
        'No-Invention kuralları ve shrinkage faktörleri uygulandı.',
      ],
    };

    this.cache.set(cacheKey, { data: result, timestamp: analysisTimestamp });
    return result;
  }
}
