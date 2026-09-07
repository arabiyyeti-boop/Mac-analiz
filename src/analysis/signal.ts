// src/analysis/signal.ts - Signal Generation, Hard Risk Filtering & Abstention Engine
import {
  MarketSignal,
  SignalState,
  DataQualityReport,
  ModelAgreement,
  AnomalyDetection,
  CalibrationReport,
} from '@/types';
import { analysisConfig } from '@/config/analysisConfig';

interface SignalInput {
  market: string;
  marketNameTr: string;
  selection: string;
  probability: number;
  dataQuality: DataQualityReport;
  agreement: ModelAgreement;
  anomalies: AnomalyDetection;
  calibration?: CalibrationReport;
  sampleSize: number;
  factors: {
    homeAdvantage?: boolean;
    strongForm?: boolean;
    xgFavorable?: boolean;
  };
}

export class SignalEngine {
  /**
   * Evaluates an individual market candidate and enforces the Hard Risk Filter
   */
  static evaluateMarketSignal(input: SignalInput): MarketSignal {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const riskFailures: string[] = [];

    const p = input.probability;
    const dq = input.dataQuality.score;
    const agr = Math.round((1 - input.agreement.divergenceScore) * 100);
    const disp = input.agreement.stdDev;
    const calStatus = input.calibration?.status || 'ACCEPTABLE';

    // 1. HARD RISK FILTER CHECKS
    const cfg = analysisConfig.thresholds;

    // Check A: Data Quality Threshold
    if (dq < cfg.minDataQualityForSignal) {
      riskFailures.push(`Yetersiz veri kalitesi: Skor ${dq} (asgari ${cfg.minDataQualityForSignal} olmalı).`);
      warnings.push('Veri yetersizliği sebebiyle güvenilir sinyal üretilemedi.');
    }

    // Check B: Sample Size
    if (input.sampleSize < cfg.minMatchesSample) {
      riskFailures.push(`Kısıtlı maç geçmişi: ${input.sampleSize} maç (asgari ${cfg.minMatchesSample} olmalı).`);
      warnings.push('Takımların güncel maç geçmişi güvenilir bir eğilim tespiti için az.');
    }

    // Check C: Model Agreement / Dispersion
    if (disp > cfg.maxDispersionForSignal) {
      riskFailures.push(`Modeller uyuşmuyor: Standart sapma ${disp.toFixed(3)} (azami ${cfg.maxDispersionForSignal} olmalı).`);
      warnings.push('İstatistiksel modeller maçın sonucu konusunda fikir birliğinde değil.');
    }

    // Check D: Blocking Anomalies
    if (input.anomalies.blockingAnomaliesCount > 0) {
      riskFailures.push('Kritik veri veya olasılık anomalisi tespit edildi.');
      warnings.push('Veri anomalisi sebebiyle model çekimser kaldı (ABSTAIN).');
    }

    // Check E: Probability Threshold
    if (p < cfg.minProbabilityForSignal) {
      riskFailures.push(`Model olasılığı eşiğin altında: %${(p * 100).toFixed(1)} (asgari %${(cfg.minProbabilityForSignal * 100).toFixed(0)} olmalı).`);
    }

    // 2. CONFIDENCE CALCULATION
    // Formula: Probability (35%) + Agreement (25%) + Data Quality (25%) + Calibration (15%) - Anomaly penalty
    const pScore = Math.min(100, (p / 0.80) * 100);
    const calScore = calStatus === 'CALIBRATED' ? 100 : calStatus === 'ACCEPTABLE' ? 70 : 40;
    const anomalyPenalty = input.anomalies.items.length * 10;

    const rawConfidence = (pScore * 0.35) + (agr * 0.25) + (dq * 0.25) + (calScore * 0.15) - anomalyPenalty;
    const confidence = Math.max(0, Math.min(100, Math.round(rawConfidence)));

    // 3. REASONS & STRENGTH FACTORS
    if (agr >= 75) reasons.push('Yüksek model uyumu (Modeller tutarlı olasılık üretti)');
    if (dq >= 75) reasons.push('Yüksek veri kalitesi ve geniş maç örneklemi');
    if (p >= 0.65) reasons.push(`Kuvvetli istatistiksel üstünlük (Model olasılığı: %${(p * 100).toFixed(1)})`);
    if (input.factors.strongForm) reasons.push('Form ve son haftaların performans ivmesi lehte');
    if (input.factors.homeAdvantage) reasons.push('Ev sahibi saha ve taraftar avantajı belirgin');
    if (input.factors.xgFavorable) reasons.push('xG (beklenen gol) farkı seçimi destekliyor');

    // 4. DETERMINE SIGNAL STATE (Per Section 34 & 71 & 110)
    let signalState: SignalState;

    if (!input.dataQuality.isSufficientForAnalysis || dq < 40) {
      signalState = 'INSUFFICIENT_DATA';
    } else if (disp > 0.22) {
      signalState = 'MODELS_DISAGREE';
    } else if (riskFailures.length > 0) {
      if (p >= 0.50 && disp <= 0.20 && dq >= 45) {
        signalState = 'WATCH'; // İzleme listesi
      } else {
        signalState = 'ABSTAIN'; // Çekimser
      }
    } else {
      // Sinyal üretilebilir
      if (p >= cfg.veryStrongProbThreshold && confidence >= cfg.veryStrongConfidenceThreshold) {
        signalState = 'VERY_STRONG';
      } else if (p >= 0.60 && confidence >= 68) {
        signalState = 'STRONG';
      } else if (p >= cfg.minProbabilityForSignal && confidence >= cfg.minConfidenceForSignal) {
        signalState = 'MEDIUM';
      } else {
        signalState = 'WEAK';
      }
    }

    return {
      market: input.market,
      marketNameTr: input.marketNameTr,
      selection: input.selection,
      modelProbability: Number(p.toFixed(4)),
      confidence,
      dataQuality: dq,
      agreementScore: agr,
      dispersion: Number(disp.toFixed(4)),
      calibrationStatus: calStatus,
      signalState,
      passedRiskFilter: riskFailures.length === 0,
      riskFilterFailures: riskFailures,
      reasons: reasons.length > 0 ? reasons : ['Model olasılığı temel dağılıma dayanıyor.'],
      warnings: warnings.concat(input.dataQuality.warnings),
    };
  }

  /**
   * Evaluates all markets for a match and selects primary signal if risk filter is passed
   */
  static evaluateAllMarkets(params: {
    ensemble: Record<string, number>;
    dataQuality: DataQualityReport;
    agreement: Record<string, ModelAgreement>;
    anomalies: AnomalyDetection;
    calibrations: Record<string, CalibrationReport>;
    sampleSize: number;
    homeTeamName: string;
    awayTeamName: string;
    factors: { homeAdvantage?: boolean; strongForm?: boolean; xgFavorable?: boolean };
  }): { signals: MarketSignal[]; primarySignal: MarketSignal | null } {
    const marketDefs: Array<{ market: string; nameTr: string; selection: string }> = [
      { market: 'MS1', nameTr: 'Ev Sahibi Galibiyeti', selection: params.homeTeamName },
      { market: 'X', nameTr: 'Beraberlik', selection: 'Beraberlik (X)' },
      { market: 'MS2', nameTr: 'Deplasman Galibiyeti', selection: params.awayTeamName },
      { market: 'OVER_25', nameTr: '2.5 Gol Üstü', selection: '2.5 Üst' },
      { market: 'UNDER_25', nameTr: '2.5 Gol Altı', selection: '2.5 Alt' },
      { market: 'BTTS_YES', nameTr: 'Karşılıklı Gol Var (KG)', selection: 'KG Var' },
      { market: 'BTTS_NO', nameTr: 'Karşılıklı Gol Yok (KG)', selection: 'KG Yok' },
    ];

    const signals: MarketSignal[] = marketDefs.map((def) => {
      const p = params.ensemble[def.market] ?? 0.33;
      const agr = params.agreement[def.market] || {
        market: def.market,
        mean: p,
        median: p,
        variance: 0,
        stdDev: 0.05,
        range: 0.1,
        divergenceScore: 0.2,
        isAgreementHigh: true,
        individualModelProbs: {},
      };
      const cal = params.calibrations[def.market];

      return this.evaluateMarketSignal({
        market: def.market,
        marketNameTr: def.nameTr,
        selection: def.selection,
        probability: p,
        dataQuality: params.dataQuality,
        agreement: agr,
        anomalies: params.anomalies,
        calibration: cal,
        sampleSize: params.sampleSize,
        factors: params.factors,
      });
    });

    // Select primary signal: only from signals that passed risk filter or have the highest verified confidence
    const candidateSignals = signals
      .filter((s) => s.passedRiskFilter && (s.signalState === 'VERY_STRONG' || s.signalState === 'STRONG' || s.signalState === 'MEDIUM'))
      .sort((a, b) => b.confidence - a.confidence || b.modelProbability - a.modelProbability);

    const primarySignal = candidateSignals.length > 0 ? candidateSignals[0] : null;

    return {
      signals,
      primarySignal,
    };
  }
}
