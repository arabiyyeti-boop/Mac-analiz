// src/prediction/settlement.ts - Automated Prediction Ledger Settlement Service
import { PredictionRecord, PredictionActualOutcome, SettlementStatus, CanonicalMatch } from '@/types';
import { predictionLedger, PredictionLedger } from '@/prediction/ledger';
import { ApiOrchestrator } from '@/api/orchestrator/ApiOrchestrator';
import { CanonicalEntityManager } from '@/entity/CanonicalEntityManager';

export interface SettlementRunResult {
  totalPending: number;
  settledCount: number;
  wonCount: number;
  lostCount: number;
  voidCount: number;
  stillPendingCount: number;
  skippedCount: number;
  settledAt: string;
  items: Array<{
    predictionId: string;
    matchId: string;
    matchSummary: string;
    market: string;
    selection: string;
    status: SettlementStatus;
    score?: string;
    brierError?: number;
    reason: string;
  }>;
}

export class PredictionSettlementService {
  private ledger: PredictionLedger;
  private orchestrator: ApiOrchestrator;
  private entityManager: CanonicalEntityManager;

  constructor(
    ledger: PredictionLedger = predictionLedger,
    orchestrator: ApiOrchestrator = ApiOrchestrator.getInstance(),
    entityManager: CanonicalEntityManager = CanonicalEntityManager.getInstance()
  ) {
    this.ledger = ledger;
    this.orchestrator = orchestrator;
    this.entityManager = entityManager;
  }

  /**
   * Evaluates market outcome based on verified final score
   */
  private evaluateMarketOutcome(
    market: string,
    homeScore: number,
    awayScore: number
  ): { outcomeWon: boolean; supported: boolean } {
    const totalGoals = homeScore + awayScore;

    switch (market) {
      case 'MS1':
        return { outcomeWon: homeScore > awayScore, supported: true };
      case 'X':
        return { outcomeWon: homeScore === awayScore, supported: true };
      case 'MS2':
        return { outcomeWon: awayScore > homeScore, supported: true };
      case 'OVER_25':
        return { outcomeWon: totalGoals > 2.5, supported: true };
      case 'UNDER_25':
        return { outcomeWon: totalGoals < 2.5, supported: true };
      case 'BTTS_YES':
        return { outcomeWon: homeScore > 0 && awayScore > 0, supported: true };
      case 'BTTS_NO':
        return { outcomeWon: homeScore === 0 || awayScore === 0, supported: true };
      default:
        return { outcomeWon: false, supported: false };
    }
  }

  /**
   * Verifies that the fetched fixture matches the immutable prediction identity
   */
  private verifyFixtureIdentity(record: PredictionRecord, match: CanonicalMatch): boolean {
    // 1. If canonical lineage matches, confirmed
    if (record.canonicalFixtureId && match.lineageId && record.canonicalFixtureId === match.lineageId) {
      return true;
    }

    // 2. If provider IDs match
    if (record.matchId === match.id || record.sourceFixtureId === match.externalId) {
      // Cross-verify team names via CanonicalEntityManager to guard against recycled or re-used IDs
      const normHomeRec = this.entityManager.normalizeName(record.homeTeam);
      const normAwayRec = this.entityManager.normalizeName(record.awayTeam);
      const normHomeMatch = this.entityManager.normalizeName(match.homeTeam.name);
      const normAwayMatch = this.entityManager.normalizeName(match.awayTeam.name);

      const homeMatch = normHomeRec === normHomeMatch || normHomeRec.includes(normHomeMatch) || normHomeMatch.includes(normHomeRec);
      const awayMatch = normAwayRec === normAwayMatch || normAwayRec.includes(normAwayMatch) || normAwayMatch.includes(normAwayRec);

      return homeMatch && awayMatch;
    }

    return false;
  }

  /**
   * Settles pending prediction records using verified real match outcomes
   */
  async settlePendingPredictions(): Promise<SettlementRunResult> {
    const pending = await this.ledger.getPendingRecords();
    const now = new Date().toISOString();

    const result: SettlementRunResult = {
      totalPending: pending.length,
      settledCount: 0,
      wonCount: 0,
      lostCount: 0,
      voidCount: 0,
      stillPendingCount: 0,
      skippedCount: 0,
      settledAt: now,
      items: [],
    };

    if (pending.length === 0) {
      return result;
    }

    for (const rec of pending) {
      try {
        // Fetch verified real match details from orchestrator
        const matchDetails = await this.orchestrator.getMatchDetails(rec.matchId);
        const match = matchDetails?.details?.match;

        if (!match) {
          result.skippedCount++;
          result.items.push({
            predictionId: rec.predictionId,
            matchId: rec.matchId,
            matchSummary: `${rec.homeTeam} vs ${rec.awayTeam}`,
            market: rec.market,
            selection: rec.selection,
            status: 'PENDING',
            reason: 'Fixture verisi sağlayıcıda bulunamadı.',
          });
          continue;
        }

        // Verify Fixture Identity & Lineage (Anti-Mismatch Protection)
        const isIdentityVerified = this.verifyFixtureIdentity(rec, match);
        if (!isIdentityVerified) {
          result.skippedCount++;
          result.items.push({
            predictionId: rec.predictionId,
            matchId: rec.matchId,
            matchSummary: `${rec.homeTeam} vs ${rec.awayTeam}`,
            market: rec.market,
            selection: rec.selection,
            status: 'PENDING',
            reason: `Fixture kimlik uyuşmazlığı tespit edildi (Beklenen: ${rec.homeTeam} vs ${rec.awayTeam}, Bulunan: ${match.homeTeam.name} vs ${match.awayTeam.name}).`,
          });
          continue;
        }

        // Check match status
        const status = match.status;

        // Case A: Postponed / Cancelled / Suspended
        if (status === 'POSTPONED' || status === 'CANCELLED' || status === 'SUSPENDED') {
          const outcome: PredictionActualOutcome = {
            status: 'VOID',
            fullTimeScore: { home: 0, away: 0 },
            outcomeWon: false,
            brierError: 0, // Void matches do not penalize calibration
            evaluatedAt: now,
            settledAt: now,
            settlementVersion: 'v2.0-auto',
            provenance: {
              provider: matchDetails.provider || 'unknown',
              sourceFixtureId: match.externalId || match.id,
              canonicalFixtureId: match.lineageId || match.id,
              matchStatus: status,
              settledAt: now,
            },
          };

          await this.ledger.updateRecordSettlement(rec.predictionId, outcome);
          result.voidCount++;
          result.settledCount++;
          result.items.push({
            predictionId: rec.predictionId,
            matchId: rec.matchId,
            matchSummary: `${rec.homeTeam} vs ${rec.awayTeam}`,
            market: rec.market,
            selection: rec.selection,
            status: 'VOID',
            reason: `Maç ${status} durumunda olduğu için tahmin VOID (geçersiz) olarak sonuçlandırıldı.`,
          });
          continue;
        }

        // Case B: Not Finished Yet (Scheduled, Timed, In-Play, Paused)
        if (status !== 'FINISHED') {
          result.stillPendingCount++;
          result.items.push({
            predictionId: rec.predictionId,
            matchId: rec.matchId,
            matchSummary: `${rec.homeTeam} vs ${rec.awayTeam}`,
            market: rec.market,
            selection: rec.selection,
            status: 'PENDING',
            reason: `Maç henüz tamamlanmadı (Mevcut Durum: ${status}).`,
          });
          continue;
        }

        // Case C: Finished match with verified score
        const homeScore = match.score?.fullTime?.home;
        const awayScore = match.score?.fullTime?.away;

        if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
          result.skippedCount++;
          result.items.push({
            predictionId: rec.predictionId,
            matchId: rec.matchId,
            matchSummary: `${rec.homeTeam} vs ${rec.awayTeam}`,
            market: rec.market,
            selection: rec.selection,
            status: 'PENDING',
            reason: 'Maç FINISHED durumunda ancak geçerli tam zaman skoru eksik.',
          });
          continue;
        }

        // Calculate market settlement
        const { outcomeWon, supported } = this.evaluateMarketOutcome(rec.market, homeScore, awayScore);
        if (!supported) {
          result.skippedCount++;
          result.items.push({
            predictionId: rec.predictionId,
            matchId: rec.matchId,
            matchSummary: `${rec.homeTeam} vs ${rec.awayTeam}`,
            market: rec.market,
            selection: rec.selection,
            status: 'PENDING',
            reason: `Desteklenmeyen market türü: ${rec.market}.`,
          });
          continue;
        }

        const settlementStatus: SettlementStatus = outcomeWon ? 'WON' : 'LOST';
        const y = outcomeWon ? 1 : 0;
        const effectiveProb = rec.calibratedProbability ?? rec.modelProbability;
        const brierError = Number(Math.pow(effectiveProb - y, 2).toFixed(4));
        const finalScoreStr = `${homeScore}-${awayScore}`;

        const outcome: PredictionActualOutcome = {
          status: settlementStatus,
          fullTimeScore: { home: homeScore, away: awayScore },
          outcomeWon,
          brierError,
          evaluatedAt: now,
          settledAt: now,
          settlementVersion: 'v2.0-auto',
          provenance: {
            provider: matchDetails.provider || 'unknown',
            sourceFixtureId: match.externalId || match.id,
            canonicalFixtureId: match.lineageId || match.id,
            finalScore: finalScoreStr,
            matchStatus: 'FINISHED',
            settledAt: now,
          },
        };

        await this.ledger.updateRecordSettlement(rec.predictionId, outcome);
        result.settledCount++;
        if (outcomeWon) {
          result.wonCount++;
        } else {
          result.lostCount++;
        }

        result.items.push({
          predictionId: rec.predictionId,
          matchId: rec.matchId,
          matchSummary: `${rec.homeTeam} vs ${rec.awayTeam}`,
          market: rec.market,
          selection: rec.selection,
          status: settlementStatus,
          score: finalScoreStr,
          brierError,
          reason: `Sonuçlandı: ${finalScoreStr} -> ${settlementStatus}`,
        });
      } catch (err: any) {
        result.skippedCount++;
        result.items.push({
          predictionId: rec.predictionId,
          matchId: rec.matchId,
          matchSummary: `${rec.homeTeam} vs ${rec.awayTeam}`,
          market: rec.market,
          selection: rec.selection,
          status: 'PENDING',
          reason: `Sağlayıcı sorgulama hatası: ${err.message || 'Bilinmeyen hata'}`,
        });
      }
    }

    return result;
  }
}

export const predictionSettlementService = new PredictionSettlementService();
