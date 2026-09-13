// src/analysis/signal.ts - Signal Generation, Hard Risk Filtering, Odds Value & Abstention Engine
import {
  MarketSignal,
  SignalState,
  DataQualityReport,
  ModelAgreement,
  AnomalyDetection,
  CalibrationReport,
  OddsModelResult,
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
  odds?: number;
  fairProbability?: number;
  rawImpliedProbability?: number;
  calibratedProbability?: number;
  rawProbability?: number;
  calibrationInfo?: any;
}

export class SignalEngine {
  /**
   * Evaluates an individual market candidate and enforces the Hard Risk Filter,
   * including strict Odds Value / Expected Value (+EV) validation.
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

    // Check Data Quality 2.0 Critical Blocking Reasons (Section 12: Abstention)
    if (input.dataQuality.blockingReasons && input.dataQuality.blockingReasons.length > 0) {
      riskFailures.push(...input.dataQuality.blockingReasons);
      warnings.push('Kritik veri kalitesi veya bütünlük sorunu tespit edildi.');
    }
    if (input.dataQuality.futureLeakageDetected) {
      riskFailures.push('Gelecek veri sızıntısı tespit edildi (Future Data Leakage).');
      warnings.push('Gelecek veri sızıntısı koruması sebebiyle analiz çekimser bırakıldı.');
    }
    if (input.dataQuality.status === 'INVALID') {
      riskFailures.push('Veri durumu geçersiz (INVALID).');
    }

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

    // 1b. ODDS VALUE & EXPECTED VALUE (EV) HARD FILTER
    let ev: number | undefined = undefined;
    let isPositiveEv = false;
    let hasValue = false;
    let valueEdge: number | undefined = undefined;
    let kellyFraction: number | undefined = undefined;
    let halfKellyFraction: number | undefined = undefined;

    if (input.odds !== undefined) {
      const odd = input.odds;
      if (!Number.isFinite(odd) || odd <= 1.0) {
        riskFailures.push('Geçersiz oran verisi (Oran 1.00 veya altında ya da tanımsız).');
        warnings.push('Piyasa oranı doğrulanamadı.');
      } else {
        // Expected Value: EV = (p * odd) - 1
        const rawEv = (p * odd) - 1;
        ev = Number(rawEv.toFixed(4));

        // Strict Positive EV filter: EV must be strictly positive (> 0.0001 epsilon)
        isPositiveEv = ev > 0.0001;

        if (input.fairProbability !== undefined && Number.isFinite(input.fairProbability) && input.fairProbability > 0) {
          valueEdge = Number((p - input.fairProbability).toFixed(4));
          hasValue = isPositiveEv && valueEdge > 0.0001;
        }

        // Section 4 & 5: EV <= 0 is strictly NOT positive EV and CANNOT qualify as a positive-EV value signal
        if (!isPositiveEv) {
          riskFailures.push(`Negatif veya sıfır beklenen değer (EV: %${(ev * 100).toFixed(2)} <= 0). Value sinyali oluşturulamaz.`);
          warnings.push('Piyasa oranı model olasılığına kıyasla pozitif beklenen değer (+EV) sunmuyor.');
        } else {
          // Kelly Criterion calculation: strictly when EV > 0 and odd > 1
          const b = odd - 1.0;
          const f = rawEv / b;
          if (Number.isFinite(f) && f > 0) {
            kellyFraction = Number(Math.min(0.25, f).toFixed(4));
            halfKellyFraction = Number(Math.min(0.05, f * 0.5).toFixed(4));
          }

          if (hasValue) {
            reasons.push(`Pozitif Beklenen Değer (+EV: %${(ev * 100).toFixed(2)}, De-vigged Avantaj: %${((valueEdge || 0) * 100).toFixed(2)})`);
          }
        }
      }
    }

    // 2. CONFIDENCE CALCULATION WITH DATA QUALITY 2.0 CEILING
    // Formula: Probability (35%) + Agreement (25%) + Data Quality (25%) + Calibration (15%) - Anomaly penalty
    const pScore = Math.min(100, (p / 0.80) * 100);
    const calScore = calStatus === 'CALIBRATED' ? 100 : calStatus === 'ACCEPTABLE' ? 70 : 40;
    const anomalyPenalty = input.anomalies.items.length * 10;

    const rawConfidence = (pScore * 0.35) + (agr * 0.25) + (dq * 0.25) + (calScore * 0.15) - anomalyPenalty;
    const confidenceCeiling = input.dataQuality.confidenceCeiling ?? 100;
    const confidence = Math.max(0, Math.min(confidenceCeiling, Math.round(rawConfidence)));

    // 3. REASONS & STRENGTH FACTORS
    if (agr >= 75) reasons.push('Yüksek model uyumu (Modeller tutarlı olasılık üretti)');
    if (dq >= 75) reasons.push('Yüksek veri kalitesi ve geniş maç örneklemi');
    if (p >= 0.65) reasons.push(`Kuvvetli istatistiksel üstünlük (Model olasılığı: %${(p * 100).toFixed(1)})`);
    if (input.factors.strongForm) reasons.push('Form ve son haftaların performans ivmesi lehte');
    if (input.factors.homeAdvantage) reasons.push('Ev sahibi saha ve taraftar avantajı belirgin');
    if (input.factors.xgFavorable) reasons.push('xG (beklenen gol) farkı seçimi destekliyor');

    // 4. DETERMINE SIGNAL STATE (Per Section 34 & 71 & 110 & Data Quality 2.0 Section 12)
    let signalState: SignalState;

    if (
      !input.dataQuality.isSufficientForAnalysis ||
      dq < 40 ||
      input.dataQuality.status === 'INVALID' ||
      input.dataQuality.futureLeakageDetected ||
      (input.dataQuality.blockingReasons && input.dataQuality.blockingReasons.length > 0)
    ) {
      signalState = 'INSUFFICIENT_DATA';
    } else if (disp > 0.22) {
      signalState = 'MODELS_DISAGREE';
    } else if (riskFailures.length > 0) {
      if (p >= 0.50 && disp <= 0.20 && dq >= 45 && (input.odds === undefined || isPositiveEv)) {
        signalState = 'WATCH'; // İzleme listesi (yalnızca EV engeli yoksa veya oran yoksa)
      } else {
        signalState = 'ABSTAIN'; // Çekimser (Negatif EV veya kritik risk filtresi reddi)
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
      odds: input.odds,
      fairProbability: input.fairProbability,
      rawImpliedProbability: input.rawImpliedProbability,
      valueEdge,
      ev,
      isPositiveEv,
      hasValue,
      kellyFraction,
      halfKellyFraction,
      calibratedProbability: input.calibratedProbability ?? Number(p.toFixed(4)),
      rawProbability: input.rawProbability ?? Number(p.toFixed(4)),
      calibrationInfo: input.calibrationInfo,
    };
  }

  /**
   * Evaluates all markets for a match and selects primary signal if risk filter is passed.
   *
   * Draws and all 1X2 markets are treated with equal rigor and priority.
   */
  static evaluateAllMarkets(params: {
    ensemble: Record<string, number>;
    rawEnsemble?: Record<string, number>;
    calibrationInfo?: any;
    dataQuality: DataQualityReport;
    agreement: Record<string, ModelAgreement>;
    anomalies: AnomalyDetection;
    calibrations: Record<string, CalibrationReport>;
    sampleSize: number;
    homeTeamName: string;
    awayTeamName: string;
    factors: { homeAdvantage?: boolean; strongForm?: boolean; xgFavorable?: boolean };
    oddsModel?: OddsModelResult;
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
      const rawP = params.rawEnsemble ? params.rawEnsemble[def.market] : p;
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

      // Bind verified odds for this market if available
      let odd: number | undefined = undefined;
      let fairProb: number | undefined = undefined;
      let rawImplied: number | undefined = undefined;

      if (params.oddsModel && params.oddsModel.available) {
        if (def.market === 'MS1') {
          odd = params.oddsModel.oddsHome;
          fairProb = params.oddsModel.impliedHome;
          rawImplied = params.oddsModel.rawImpliedHome;
        } else if (def.market === 'X') {
          odd = params.oddsModel.oddsDraw;
          fairProb = params.oddsModel.impliedDraw;
          rawImplied = params.oddsModel.rawImpliedDraw;
        } else if (def.market === 'MS2') {
          odd = params.oddsModel.oddsAway;
          fairProb = params.oddsModel.impliedAway;
          rawImplied = params.oddsModel.rawImpliedAway;
        }
      }

      return this.evaluateMarketSignal({
        market: def.market,
        marketNameTr: def.nameTr,
        selection: def.selection,
        probability: p,
        calibratedProbability: p,
        rawProbability: rawP,
        calibrationInfo: params.calibrationInfo,
        dataQuality: params.dataQuality,
        agreement: agr,
        anomalies: params.anomalies,
        calibration: cal,
        sampleSize: params.sampleSize,
        factors: params.factors,
        odds: odd,
        fairProbability: fairProb,
        rawImpliedProbability: rawImplied,
      });
    });

    // Select primary signal: only from signals that passed risk filter
    // Candidate signals that have verified odds MUST have positive EV
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
