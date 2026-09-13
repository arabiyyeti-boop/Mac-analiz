// src/prediction/ledger.ts - Immutable Prediction Ledger & Outcome Evaluator
import {
  PredictionRecord,
  MatchAnalysis,
  MarketSignal,
  PredictionActualOutcome,
  ClvRecord,
} from '@/types';
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
  async recordPrediction(
    analysis: MatchAnalysis,
    signal: MarketSignal,
    oddsData?: {
      snapshotId?: string;
      opening?: number;
      current?: number;
      source?: string;
      overround?: number;
      probabilityEdge?: number;
      squadSnapshotId?: string;
      marketRegime?: string;
      closingOdds?: number;
      clvPercent?: number;
      recordVersion?: string;
      ev?: number;
      kellyFraction?: number;
    }
  ): Promise<PredictionRecord> {
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

    const createdAt = new Date().toISOString();
    const isPriorToKickoff = new Date(createdAt).getTime() <= new Date(analysis.match.utcDate).getTime();

    const record: PredictionRecord = {
      predictionId,
      matchId: analysis.match.id,
      canonicalFixtureId: analysis.match.lineageId || analysis.match.id,
      sourceFixtureId: analysis.match.externalId || analysis.match.id,
      homeTeamId: analysis.match.homeTeam.id,
      awayTeamId: analysis.match.awayTeam.id,
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
      calibratedProbability: (signal as any).calibratedProbability,
      calibrationInfo: (signal as any).calibrationInfo,
      evSnapshot: signal.ev ?? oddsData?.ev,
      kellySnapshot: signal.halfKellyFraction ?? signal.kellyFraction ?? oddsData?.kellyFraction,
      analysisVersion: analysis.versions.analysisVersion,
      modelVersion: analysis.versions.modelVersion,
      configVersion: analysis.versions.configVersion,
      calibrationVersion: analysis.versions.calibrationVersion,
      createdAt,
      matchStartTime: analysis.match.utcDate,
      oddsSnapshotId: oddsData?.snapshotId,
      oddsMarketSnapshot: oddsData
        ? {
            opening: oddsData.opening,
            current: oddsData.current,
            source: oddsData.source || 'Nesine',
            overround: oddsData.overround,
          }
        : undefined,
      probabilityEdge: oddsData?.probabilityEdge ?? signal.valueEdge,
      lookAheadBiasVerified: isPriorToKickoff,
      squadSnapshotId: oddsData?.squadSnapshotId,
      marketRegime: oddsData?.marketRegime,
      closingOdds: oddsData?.closingOdds,
      clvPercent: oddsData?.clvPercent,
      recordVersion: oddsData?.recordVersion || 'v2',
      settlementStatus: 'PENDING',
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
   * Retrieves all pending prediction records awaiting settlement
   */
  async getPendingRecords(): Promise<PredictionRecord[]> {
    const records = await this.getAllRecords();
    return records.filter(
      (r) => !r.actualOutcome || r.settlementStatus === 'PENDING'
    );
  }

  /**
   * Evaluates prediction when full time match score is final
   * Appends actualOutcome without mutating original prediction probability or inputs
   */
  async evaluatePrediction(
    predictionId: string,
    homeScore: number,
    awayScore: number
  ): Promise<PredictionRecord | null> {
    const records = await this.getAllRecords();
    const index = records.findIndex((r) => r.predictionId === predictionId);
    if (index === -1) return null;

    const current = records[index];
    if (current.actualOutcome && current.settlementStatus && current.settlementStatus !== 'PENDING') {
      return current; // already settled
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
    const prob = current.calibratedProbability ?? current.modelProbability;
    const brierError = Number(Math.pow(prob - y, 2).toFixed(4));
    const now = new Date().toISOString();

    const actualOutcome: PredictionActualOutcome = {
      status: outcomeWon ? 'WON' : 'LOST',
      fullTimeScore: { home: homeScore, away: awayScore },
      outcomeWon,
      brierError,
      evaluatedAt: now,
      settledAt: now,
      settlementVersion: 'v2.0-manual',
    };

    const updatedRecord: PredictionRecord = {
      ...current,
      settlementStatus: outcomeWon ? 'WON' : 'LOST',
      actualOutcome,
    };

    records[index] = updatedRecord;
    await this.storage.set(LEDGER_STORAGE_KEY, records);
    return updatedRecord;
  }

  /**
   * Updates record with automated settlement outcome without mutating original snapshot
   */
  async updateRecordSettlement(
    predictionId: string,
    outcome: PredictionActualOutcome
  ): Promise<PredictionRecord | null> {
    const records = await this.getAllRecords();
    const index = records.findIndex((r) => r.predictionId === predictionId);
    if (index === -1) return null;

    const current = records[index];
    // Idempotency: If already settled with same status, return early
    if (
      current.settlementStatus === outcome.status &&
      current.actualOutcome?.settlementVersion === outcome.settlementVersion
    ) {
      return current;
    }

    const updatedRecord: PredictionRecord = {
      ...current,
      settlementStatus: outcome.status,
      actualOutcome: outcome,
    };

    records[index] = updatedRecord;
    await this.storage.set(LEDGER_STORAGE_KEY, records);
    return updatedRecord;
  }

  /**
   * Updates record with Closing Line Value (CLV) data
   */
  async updateRecordClv(
    predictionId: string,
    clv: ClvRecord
  ): Promise<PredictionRecord | null> {
    const records = await this.getAllRecords();
    const index = records.findIndex((r) => r.predictionId === predictionId);
    if (index === -1) return null;

    const current = records[index];
    const updatedRecord: PredictionRecord = {
      ...current,
      closingOdds: clv.closingOdds ?? current.closingOdds,
      clvPercent: clv.clvPercent ?? current.clvPercent,
      clvRecord: clv,
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
