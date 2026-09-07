// src/prediction/ledger.ts - Immutable Prediction Ledger & Outcome Evaluator
import { PredictionRecord, MatchAnalysis, MarketSignal } from '@/types';
import { StorageProvider } from '@/storage/StorageProvider';
import { defaultStorage } from '@/storage/LocalStorageProvider';

const LEDGER_STORAGE_KEY = 'macanaliz_prediction_ledger_v1';

export class PredictionLedger {
  private storage: StorageProvider;

  constructor(storage: StorageProvider = defaultStorage) {
    this.storage = storage;
  }

  /**
   * Records a snapshot of an active prediction into the immutable ledger
   */
  async recordPrediction(analysis: MatchAnalysis, signal: MarketSignal): Promise<PredictionRecord> {
    const existing = await this.getAllRecords();

    // Check if this match and market is already recorded to prevent duplicate records
    const existingRecord = existing.find(
      (r) => r.matchId === analysis.match.id && r.market === signal.market
    );
    if (existingRecord) {
      return existingRecord;
    }

    const predictionId = `pred_${analysis.match.id}_${signal.market}_${Date.now()}`;

    const modelOutputs: Record<string, number> = {};
    if (analysis.models.poisson) modelOutputs.poisson = analysis.models.poisson.pHome;
    if (analysis.models.dixonColes) modelOutputs.dixonColes = analysis.models.dixonColes.pHome;
    if (analysis.models.elo) modelOutputs.elo = analysis.models.elo.pHome;
    if (analysis.models.form) modelOutputs.form = analysis.models.form.pHome;

    const record: PredictionRecord = {
      predictionId,
      matchId: analysis.match.id,
      matchDate: analysis.match.utcDate,
      homeTeam: analysis.match.homeTeam.name,
      awayTeam: analysis.match.awayTeam.name,
      league: analysis.match.league.name,
      market: signal.market,
      selection: signal.selection,
      modelProbability: signal.modelProbability,
      confidence: signal.confidence,
      dataQuality: signal.dataQuality,
      agreementScore: signal.agreementScore,
      dispersion: signal.dispersion,
      signalState: signal.signalState,
      modelOutputs,
      calibrationMetrics: {
        brier: analysis.calibration[signal.market]?.brierScore ?? 0.20,
        logLoss: analysis.calibration[signal.market]?.logLoss ?? 0.58,
      },
      analysisVersion: analysis.versions.analysisVersion,
      modelVersion: analysis.versions.modelVersion,
      configVersion: analysis.versions.configVersion,
      calibrationVersion: analysis.versions.calibrationVersion,
      createdAt: new Date().toISOString(),
      matchStartTime: analysis.match.utcDate,
    };

    existing.unshift(record);
    await this.storage.set(LEDGER_STORAGE_KEY, existing);
    return record;
  }

  /**
   * Retrieves all stored immutable prediction records
   */
  async getAllRecords(): Promise<PredictionRecord[]> {
    const records = await this.storage.get<PredictionRecord[]>(LEDGER_STORAGE_KEY);
    return records || [];
  }

  /**
   * Evaluates prediction when full time match score is final
   * Appends actualOutcome without mutating original prediction probability
   */
  async evaluatePrediction(predictionId: string, homeScore: number, awayScore: number): Promise<PredictionRecord | null> {
    const records = await this.getAllRecords();
    const index = records.findIndex((r) => r.predictionId === predictionId);
    if (index === -1) return null;

    const current = records[index];
    if (current.actualOutcome) {
      return current; // already evaluated
    }

    let outcomeWon = false;
    const totalGoals = homeScore + awayScore;

    switch (current.market) {
      case 'MS1':
        outcomeWon = homeScore > awayScore;
        break;
      case 'X':
        outcomeWon = homeScore === awayScore;
        break;
      case 'MS2':
        outcomeWon = awayScore > homeScore;
        break;
      case 'OVER_25':
        outcomeWon = totalGoals > 2.5;
        break;
      case 'UNDER_25':
        outcomeWon = totalGoals < 2.5;
        break;
      case 'BTTS_YES':
        outcomeWon = homeScore > 0 && awayScore > 0;
        break;
      case 'BTTS_NO':
        outcomeWon = homeScore === 0 || awayScore === 0;
        break;
      default:
        outcomeWon = false;
    }

    const y = outcomeWon ? 1 : 0;
    const brierError = Number(Math.pow(current.modelProbability - y, 2).toFixed(4));

    const updatedRecord: PredictionRecord = {
      ...current,
      actualOutcome: {
        fullTimeScore: { home: homeScore, away: awayScore },
        outcomeWon,
        brierError,
        evaluatedAt: new Date().toISOString(),
      },
    };

    records[index] = updatedRecord;
    await this.storage.set(LEDGER_STORAGE_KEY, records);
    return updatedRecord;
  }

  /**
   * Clears ledger records (for settings reset)
   */
  async clearLedger(): Promise<void> {
    await this.storage.remove(LEDGER_STORAGE_KEY);
  }
}

export const predictionLedger = new PredictionLedger();
