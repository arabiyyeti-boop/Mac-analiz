// src/analysis/engine.ts - Full Statistical Match Analysis Pipeline
import {
  CanonicalMatch,
  MatchAnalysis,
  CanonicalForm,
  CanonicalH2H,
  CanonicalStanding,
  CanonicalStats,
  CanonicalOdds,
  CanonicalMatchSquadData,
  DataProvenance,
} from '@/types';
import { calculatePoisson } from './poisson';
import { calculateDixonColes } from './dixonColes';
import { calculateElo, deriveEloFromStanding } from './elo';
import { calculateFormModel } from './form';
import { calculateHomeAway } from './homeAway';
import { getLeagueBaseline } from './league';
import { calculateXGModel } from './xg';
import { calculateOddsModel } from './odds';
import { synthesizeEnsemble } from './ensemble';
import { calculateAgreement } from './agreement';
import { AnomalyEngine } from './anomaly';
import { CalibrationEngine } from './calibration';
import { SignalEngine } from './signal';
import { DataValidator } from '@/api/validation/DataValidator';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';
import { TeamStrengthEngine } from './teamStrength';
import { OpponentAdjustedFormEngine } from './opponentAdjustedForm';
import { AdvancedXGEngine } from './advancedXG';
import { SquadImpactEngine } from './squadImpact';
import {
  ANALYSIS_VERSION,
  MODEL_VERSION,
  DATA_VERSION,
  CONFIG_VERSION,
  CALIBRATION_VERSION,
} from '@/config/analysisConfig';

export interface AnalysisInputData {
  match: CanonicalMatch;
  homeForm?: CanonicalForm;
  awayForm?: CanonicalForm;
  h2h?: CanonicalH2H;
  standing?: { home?: CanonicalStanding; away?: CanonicalStanding };
  stats?: CanonicalStats;
  odds?: CanonicalOdds;
  squadData?: CanonicalMatchSquadData;
  provenance?: DataProvenance;
  sourceConflictWarning?: string;
}

export class MatchAnalysisEngine {
  public static run(input: AnalysisInputData): MatchAnalysis {
    const { match, homeForm, awayForm, standing, stats, odds } = input;
    let verifiedH2h = input.h2h;

    // 1. Verify H2H binding and status
    if (verifiedH2h && verifiedH2h.status !== 'MISSING' && verifiedH2h.recentMatches && verifiedH2h.recentMatches.length > 0) {
      const verification = CanonicalEntityManager.getInstance().verifyH2HBinding(match, verifiedH2h);
      if (!verification.isValid) {
        verifiedH2h.status = 'LOW_CONFIDENCE';
        verifiedH2h.confidence = 0.3;
      }
    }

    // 2. Data Quality Evaluation
    const homeFormCount = homeForm?.matchesPlayed ?? (standing?.home?.playedGames || 8);
    const awayFormCount = awayForm?.matchesPlayed ?? (standing?.away?.playedGames || 8);

    const dataQuality = DataValidator.computeDataQuality({
      match,
      h2h: verifiedH2h,
      homeForm,
      awayForm,
      homeFormCount,
      awayFormCount,
      hasStats: Boolean(stats),
      hasXg: Boolean((stats?.homeXG !== undefined && stats?.awayXG !== undefined) || stats?.isRealXG),
      hasInjuries: Boolean(stats?.topScorers?.length),
      odds,
      standing,
      providerHealthScore: 10,
    });

    // 2. League Baseline
    const leagueModel = getLeagueBaseline(match.league?.code, match.league?.name);

    // 3. Expected Goals Calculation for Poisson & Dixon-Coles
    // Derive lambdaHome and lambdaAway based on standing/goals or default baseline
    let lambdaHome = 1.55;
    let lambdaAway = 1.15;

    if (standing?.home && standing?.away && standing.home.playedGames > 0 && standing.away.playedGames > 0) {
      const homeScoringRate = standing.home.goalsFor / standing.home.playedGames;
      const homeConcedingRate = standing.home.goalsAgainst / standing.home.playedGames;
      const awayScoringRate = standing.away.goalsFor / standing.away.playedGames;
      const awayConcedingRate = standing.away.goalsAgainst / standing.away.playedGames;

      lambdaHome = Math.max(0.3, Math.min(4.5, (homeScoringRate * awayConcedingRate) / (leagueModel.avgGoals / 2)));
      lambdaAway = Math.max(0.3, Math.min(4.5, (awayScoringRate * homeConcedingRate) / (leagueModel.avgGoals / 2)));
    } else if (homeForm && awayForm) {
      lambdaHome = Math.max(0.3, Math.min(4.5, homeForm.goalsScoredAvg));
      lambdaAway = Math.max(0.3, Math.min(4.5, awayForm.goalsScoredAvg));
    }

    // 4. Statistical Models
    const poisson = calculatePoisson(lambdaHome, lambdaAway);
    const dixonColes = calculateDixonColes(lambdaHome, lambdaAway);

    // Elo
    const homeElo = deriveEloFromStanding(
      standing?.home?.position ?? 8,
      20,
      standing?.home ? (standing.home.points / Math.max(1, standing.home.playedGames)) : 1.4
    );
    const awayElo = deriveEloFromStanding(
      standing?.away?.position ?? 12,
      20,
      standing?.away ? (standing.away.points / Math.max(1, standing.away.playedGames)) : 1.2
    );
    const elo = calculateElo(homeElo, awayElo);

    // Form
    const form = calculateFormModel(homeForm, awayForm);

    // Home / Away
    const homeAway = calculateHomeAway({
      homeScoredAtHome: lambdaHome,
      homeConcededAtHome: lambdaAway * 0.9,
      awayScoredAtAway: lambdaAway,
      awayConcededAtAway: lambdaHome * 1.1,
    });

    // xG (ONLY if real verified xG for both home and away is present in stats)
    const xg = (stats?.homeXG !== undefined && stats?.awayXG !== undefined)
      ? calculateXGModel(stats.homeXG, stats.awayXG)
      : calculateXGModel(undefined, undefined);

    // Market Odds (if present) - raw implied probabilities for ensemble input
    const initialOddsModel = calculateOddsModel(odds);

    // 4.5. Dynamic Team Strength Evaluation (Feature Layer)
    const teamStrength = TeamStrengthEngine.evaluateMatch({
      match,
      homeStanding: standing?.home,
      awayStanding: standing?.away,
      homeForm,
      awayForm,
      dataQuality,
      leagueBaselineAvgGoals: leagueModel.avgGoals,
    });

    // 4.6. Opponent-Adjusted Form v2.0 Evaluation (Feature Layer)
    const opponentAdjustedForm = OpponentAdjustedFormEngine.evaluateMatch({
      match,
      homeTeamStrength: teamStrength.home,
      awayTeamStrength: teamStrength.away,
      homeStanding: standing?.home,
      awayStanding: standing?.away,
      homeForm,
      awayForm,
      dataQuality,
      leagueBaselineAvgGoals: leagueModel.avgGoals,
    });

    // 4.7. Advanced xG v2.0 Evaluation (Feature Layer)
    const advancedXG = AdvancedXGEngine.evaluateMatch({
      match,
      stats,
      homeStanding: standing?.home,
      awayStanding: standing?.away,
      homeForm,
      awayForm,
      dataQuality,
      modelExpectedGoals: {
        home: lambdaHome,
        away: lambdaAway,
        sourceModel: 'Poisson (Bivariate PMF) & Dixon-Coles',
      },
    });

    // 4.8. Squad & Player Impact v2.0 Evaluation (Feature Layer)
    const squadImpact = SquadImpactEngine.evaluateMatch({
      match,
      squadData: input.squadData,
      teamStrength,
      opponentAdjustedForm,
      advancedXG,
      dataQuality,
    });

    // 5. Ensemble Synthesizer
    const ensemble = synthesizeEnsemble({
      poisson,
      dixonColes,
      elo,
      form,
      homeAway,
      league: leagueModel,
      xg,
      odds: initialOddsModel,
    });

    // 5b. Post-Processing Probability Calibration Layer (P2-1)
    // Coherent multiclass calibration for 1X2 outcomes ensuring sum(P) === 1.0
    // Raw models are never touched. Zero circular dependency with odds.
    const cal1X2 = CalibrationEngine.calibrate1X2({
      pHome: ensemble.MS1,
      pDraw: ensemble.X,
      pAway: ensemble.MS2,
    });

    const calibratedEnsemble = {
      ...ensemble,
      MS1: cal1X2.calibrated.pHome,
      X: cal1X2.calibrated.pDraw,
      MS2: cal1X2.calibrated.pAway,
    };

    // 5c. Odds Value / Expected Value (EV) Hardening (P1-3)
    // Evaluate Value Edge, Expected Value (EV), and Kelly Criterion using post-processed calibrated probabilities
    // (Home, Draw, and Away evaluated on equal footing with zero circular dependency)
    const oddsModel = calculateOddsModel(
      odds,
      calibratedEnsemble.MS1,
      calibratedEnsemble.X,
      calibratedEnsemble.MS2
    );

    // 6. Model Agreement & Dispersion for each market
    const agreement: Record<string, any> = {
      MS1: calculateAgreement('MS1', {
        poisson: poisson.pHome,
        dixonColes: dixonColes.pHome,
        elo: elo.pHome,
        form: form.pHome,
        homeAway: homeAway.pHome,
        xg: xg.available ? xg.pHome : undefined,
      }),
      X: calculateAgreement('X', {
        poisson: poisson.pDraw,
        dixonColes: dixonColes.pDraw,
        elo: elo.pDraw,
        form: form.pDraw,
        homeAway: homeAway.pDraw,
        xg: xg.available ? xg.pDraw : undefined,
      }),
      MS2: calculateAgreement('MS2', {
        poisson: poisson.pAway,
        dixonColes: dixonColes.pAway,
        elo: elo.pAway,
        form: form.pAway,
        homeAway: homeAway.pAway,
        xg: xg.available ? xg.pAway : undefined,
      }),
      OVER_25: calculateAgreement('OVER_25', {
        poisson: poisson.pOver25,
        dixonColes: dixonColes.pOver25,
        form: form.pOver25,
        league: leagueModel.over25Rate,
      }),
      UNDER_25: calculateAgreement('UNDER_25', {
        poisson: poisson.pUnder25,
        dixonColes: dixonColes.pUnder25,
        form: 1 - form.pOver25,
        league: 1 - leagueModel.over25Rate,
      }),
      BTTS_YES: calculateAgreement('BTTS_YES', {
        poisson: poisson.pBttsYes,
        dixonColes: dixonColes.pBttsYes,
        form: form.pBttsYes,
        league: leagueModel.bttsRate,
      }),
      BTTS_NO: calculateAgreement('BTTS_NO', {
        poisson: poisson.pBttsNo,
        dixonColes: dixonColes.pBttsNo,
        form: 1 - form.pBttsYes,
        league: 1 - leagueModel.bttsRate,
      }),
    };

    // 7. Anomaly Engine
    const anomalies = AnomalyEngine.evaluate({
      match,
      probs1X2: { home: ensemble.MS1, draw: ensemble.X, away: ensemble.MS2 },
      stats,
      sourceConflictWarning: input.sourceConflictWarning,
    });

    // 8. Uncertainty calculation
    const modelUncertainty = agreement.MS1.divergenceScore;
    const dataUncertainty = Number((1 - (dataQuality.score / 100)).toFixed(3));
    const combinedUncertainty = Number(((modelUncertainty * 0.6) + (dataUncertainty * 0.4)).toFixed(3));

    // 9. Calibrations
    const calibrations = {
      MS1: CalibrationEngine.getCalibrationReport('MS1'),
      X: CalibrationEngine.getCalibrationReport('X'),
      MS2: CalibrationEngine.getCalibrationReport('MS2'),
      OVER_25: CalibrationEngine.getCalibrationReport('OVER_25'),
      UNDER_25: CalibrationEngine.getCalibrationReport('UNDER_25'),
      BTTS_YES: CalibrationEngine.getCalibrationReport('BTTS_YES'),
      BTTS_NO: CalibrationEngine.getCalibrationReport('BTTS_NO'),
    };

    // 10. Signals & Hard Risk Filtering
    const sampleSize = Math.min(homeFormCount, awayFormCount);
    const { signals, primarySignal } = SignalEngine.evaluateAllMarkets({
      ensemble: calibratedEnsemble,
      rawEnsemble: ensemble,
      calibrationInfo: cal1X2.info,
      dataQuality,
      agreement,
      anomalies,
      calibrations,
      sampleSize,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      factors: {
        homeAdvantage: homeAway.homeAdvantageFactor > 1.25,
        strongForm: form.homeFormScore > 65 || form.awayFormScore > 65,
        xgFavorable: xg.available && Math.abs(xg.xgDiff || 0) > 0.4,
      },
      oddsModel,
    });

    const provenance: DataProvenance = input.provenance || {
      source: match.provider,
      provider: match.provider,
      retrievedAt: new Date().toISOString(),
      effectiveAt: match.utcDate,
      freshness: dataQuality.freshnessClass === 'STALE' ? 'STALE' : dataQuality.freshnessClass === 'AGING' ? 'RECENT' : 'FRESH',
      validationStatus: dataQuality.status === 'INVALID' ? 'SEMANTIC_FAIL' : dataQuality.status === 'CONFLICTING' ? 'SOURCE_CONFLICT' : !dataQuality.isSufficientForAnalysis ? 'INSUFFICIENT' : 'VALIDATED',
    };

    return {
      match,
      h2h: verifiedH2h,
      dataQuality,
      provenance,
      models: {
        poisson,
        dixonColes,
        elo,
        form,
        homeAway,
        league: leagueModel,
        xg,
        odds: oddsModel,
      },
      teamStrength,
      opponentAdjustedForm,
      advancedXG,
      squadImpact,
      ensemble,
      agreement,
      uncertainty: {
        modelUncertainty,
        dataUncertainty,
        combinedUncertainty,
      },
      anomalies,
      calibration: calibrations,
      signals,
      primarySignal,
      versions: {
        analysisVersion: ANALYSIS_VERSION,
        modelVersion: MODEL_VERSION,
        dataVersion: DATA_VERSION,
        configVersion: CONFIG_VERSION,
        calibrationVersion: CALIBRATION_VERSION,
      },
      createdAt: new Date().toISOString(),
    };
  }
}
