// src/analysis/clv.ts - Closing Line Value (CLV) Engine
import { ClvRecord, ClvAggregateReport, PredictionRecord, CanonicalOdds } from '@/types';
import { calculateMultiplicativeFairProbabilities } from './odds';

export interface CalculateClvParams {
  predictionId: string;
  canonicalFixtureId?: string;
  market: string;
  selection: string;
  predictionOdds: number;
  closingOdds?: number;
  predictionTimestamp: string;
  closingTimestamp?: string;
  kickoffTimestamp?: string;
  predictionMarketOdds?: { home: number; draw: number; away: number };
  closingMarketOdds?: { home: number; draw: number; away: number };
}

export class ClvEngine {
  /**
   * Calculates outcome-specific Closing Line Value (CLV)
   *
   * FORMULAS:
   * 1. Odds Ratio CLV:
   *    clvOddsRatio = predictionOdds / closingOdds
   *    clvPercent   = (clvOddsRatio - 1) * 100%
   *    Interpretation:
   *    - Positive (> 0%): Beat the closing line. Odds shortened before kickoff (e.g. took 2.20, closed at 2.00 => +10.0%).
   *    - Negative (< 0%): Closing line drifted against prediction (e.g. took 2.00, closed at 2.20 => -9.09%).
   *
   * 2. De-Vigged Probability Delta:
   *    clvFairProbDelta = closingFairProb - predictionFairProb
   *    Interpretation:
   *    - Positive (> 0): The closing market attached higher fair probability to the selection than at prediction time.
   *
   * 3. Closing Expected Value (evClosing):
   *    evClosing = (closingFairProb * predictionOdds) - 1
   */
  static calculateClv(params: CalculateClvParams): ClvRecord {
    const {
      predictionId,
      canonicalFixtureId,
      market,
      selection,
      predictionOdds,
      closingOdds,
      predictionTimestamp,
      closingTimestamp,
      kickoffTimestamp,
      predictionMarketOdds,
      closingMarketOdds,
    } = params;

    const baseRecord: ClvRecord = {
      predictionId,
      canonicalFixtureId,
      market,
      selection,
      predictionOdds,
      closingOdds,
      predictionTimestamp,
      closingTimestamp,
      kickoffTimestamp,
      calculationVersion: 'clv_v2.0',
      status: 'MISSING',
    };

    // 1. Validate existence of valid closing odds
    if (!closingOdds || closingOdds <= 1.0) {
      return {
        ...baseRecord,
        status: 'MISSING',
      };
    }

    // 2. Pre-kickoff live odds protection:
    // If closing odds timestamp is strictly after match kickoff, it is disqualified as live in-play odds
    if (closingTimestamp && kickoffTimestamp) {
      const closingTime = new Date(closingTimestamp).getTime();
      const kickoffTime = new Date(kickoffTimestamp).getTime();
      if (closingTime > kickoffTime) {
        return {
          ...baseRecord,
          status: 'LIVE_DISQUALIFIED',
        };
      }
    }

    // 3. Compute Odds-Ratio CLV
    const clvOddsRatio = Number((predictionOdds / closingOdds).toFixed(4));
    const clvPercent = Number(((clvOddsRatio - 1) * 100).toFixed(2));
    const isPositiveClv = clvPercent > 0;

    // 4. Compute Consistent De-Vigged Fair Probabilities (if full market is available)
    let predictionFairProb: number | undefined;
    let closingFairProb: number | undefined;
    let clvFairProbDelta: number | undefined;
    let evClosing: number | undefined;

    if (predictionMarketOdds && closingMarketOdds) {
      const predFair = calculateMultiplicativeFairProbabilities(
        predictionMarketOdds.home,
        predictionMarketOdds.draw,
        predictionMarketOdds.away
      );
      const closeFair = calculateMultiplicativeFairProbabilities(
        closingMarketOdds.home,
        closingMarketOdds.draw,
        closingMarketOdds.away
      );

      let key: 'home' | 'draw' | 'away' = 'home';
      if (selection === 'X' || market === 'X') key = 'draw';
      else if (selection === 'MS2' || market === 'MS2') key = 'away';

      predictionFairProb = predFair[key];
      closingFairProb = closeFair[key];
      clvFairProbDelta = Number((closingFairProb - predictionFairProb).toFixed(4));
      evClosing = Number(((closingFairProb * predictionOdds) - 1).toFixed(4));
    }

    return {
      predictionId,
      canonicalFixtureId,
      market,
      selection,
      predictionOdds,
      closingOdds,
      predictionTimestamp,
      closingTimestamp,
      kickoffTimestamp,
      clvOddsRatio,
      clvPercent,
      predictionFairProb,
      closingFairProb,
      clvFairProbDelta,
      evClosing,
      isPositiveClv,
      status: 'CALCULATED',
      calculationVersion: 'clv_v2.0',
    };
  }

  /**
   * Aggregates CLV performance across prediction ledger records
   * Requires a minimum sample of 5 records to declare sufficient data
   */
  static aggregateClv(records: PredictionRecord[]): ClvAggregateReport {
    const validClvs = records
      .map((r) => r.clvRecord)
      .filter((c): c is ClvRecord => c !== undefined && c.status === 'CALCULATED' && c.clvPercent !== undefined);

    if (validClvs.length === 0) {
      return {
        sampleSize: 0,
        positiveClvCount: 0,
        positiveClvRate: 0,
        meanClvPercent: 0,
        medianClvPercent: 0,
        status: 'NO_DATA',
      };
    }

    const sampleSize = validClvs.length;
    const positiveClvCount = validClvs.filter((c) => (c.clvPercent ?? 0) > 0).length;
    const positiveClvRate = Number(((positiveClvCount / sampleSize) * 100).toFixed(1));

    const clvValues = validClvs.map((c) => c.clvPercent!).sort((a, b) => a - b);
    const sumClv = clvValues.reduce((acc, v) => acc + v, 0);
    const meanClvPercent = Number((sumClv / sampleSize).toFixed(2));

    // Median calculation
    const mid = Math.floor(clvValues.length / 2);
    const medianClvPercent =
      clvValues.length % 2 !== 0
        ? clvValues[mid]
        : Number(((clvValues[mid - 1] + clvValues[mid]) / 2).toFixed(2));

    const probDeltas = validClvs
      .map((c) => c.clvFairProbDelta)
      .filter((d): d is number => d !== undefined);
    const meanProbDelta =
      probDeltas.length > 0
        ? Number((probDeltas.reduce((a, b) => a + b, 0) / probDeltas.length).toFixed(4))
        : undefined;

    return {
      sampleSize,
      positiveClvCount,
      positiveClvRate,
      meanClvPercent,
      medianClvPercent,
      meanProbDelta,
      status: sampleSize >= 5 ? 'SUFFICIENT_DATA' : 'INSUFFICIENT_SAMPLE',
    };
  }
}
