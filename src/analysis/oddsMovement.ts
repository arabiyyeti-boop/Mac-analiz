// src/analysis/oddsMovement.ts - Overround, Fair Probability, Odds Movement & Probability Edge Engine
import {
  OddsSnapshot,
  OddsMovementItem,
  ProbabilityEdgeResult,
  OddsHistory,
  CanonicalOddsItem,
  OddsFreshnessStatus,
} from '@/types/odds';

export class OddsMovementEngine {
  /**
   * Item 117: Validates if an odds value is strictly legal (> 1.00, finite, not NaN, not Infinity, <= 1000)
   */
  public static isValidOdd(odd: unknown): boolean {
    if (typeof odd !== 'number') return false;
    return Number.isFinite(odd) && !isNaN(odd) && odd > 1.00 && odd <= 1000;
  }

  /**
   * Detailed validation returning specific failure reason
   */
  public static validateOdd(odd: unknown): { isValid: boolean; error?: string } {
    if (odd === undefined || odd === null) {
      return { isValid: false, error: 'Oran değeri boş olamaz.' };
    }
    if (typeof odd !== 'number') {
      return { isValid: false, error: 'Oran sayısal olmalıdır.' };
    }
    if (isNaN(odd)) {
      return { isValid: false, error: 'Oran değeri NaN olamaz.' };
    }
    if (!Number.isFinite(odd)) {
      return { isValid: false, error: 'Oran değeri Infinity olamaz.' };
    }
    if (odd <= 1.00) {
      return { isValid: false, error: `Oran 1.00 den büyük olmalıdır (Gelen: ${odd}).` };
    }
    if (odd > 1000) {
      return { isValid: false, error: `Oran anormal derecede yüksek (Gelen: ${odd}).` };
    }
    return { isValid: true };
  }

  /**
   * Item 118: Calculates bookmaker overround (margin %) and fair (normalized) probabilities.
   * overround = Σ (1 / odds)
   * normalizedP = impliedP / totalImpliedP
   */
  public static calculateOverround(odds: number[]): {
    overroundPercent: number;
    rawImpliedProbabilities: number[];
    fairProbabilities: number[];
    totalImplied: number;
  } {
    const validOdds = odds.filter(this.isValidOdd);
    if (validOdds.length === 0 || validOdds.length !== odds.length) {
      return {
        overroundPercent: 0,
        rawImpliedProbabilities: odds.map(() => 0),
        fairProbabilities: odds.map(() => 0),
        totalImplied: 0,
      };
    }

    const rawImplied = validOdds.map((o) => Number((1 / o).toFixed(6)));
    const sumInverses = rawImplied.reduce((acc, v) => acc + v, 0);

    const overroundPercent = Number(((sumInverses - 1) * 100).toFixed(2));
    const fairProbabilities = rawImplied.map((inv) => Number((inv / sumInverses).toFixed(4)));

    return {
      overroundPercent,
      rawImpliedProbabilities: rawImplied,
      fairProbabilities,
      totalImplied: Number(sumInverses.toFixed(4)),
    };
  }

  /**
   * Item 122: Assesses odds data freshness based on capturedAt timestamp
   */
  public static checkFreshness(capturedAt: string): OddsFreshnessStatus {
    if (!capturedAt) return 'UNAVAILABLE';
    const capturedTime = new Date(capturedAt).getTime();
    if (isNaN(capturedTime)) return 'UNAVAILABLE';

    const now = Date.now();
    const diffMs = now - capturedTime;

    // Negative future dates are treated as unavailable/invalid
    if (diffMs < -60000) return 'UNAVAILABLE';

    const diffMinutes = diffMs / (1000 * 60);

    if (diffMinutes <= 15) return 'FRESH';
    if (diffMinutes <= 120) return 'RECENT';
    return 'STALE';
  }

  /**
   * Item 138: Validates temporal integrity (Look-Ahead Bias Prevention)
   * Odds captured AFTER the match kickoff time must be rejected for pre-match analysis or backtesting.
   */
  public static validateTemporalIntegrity(
    snapshotTime: string,
    matchKickoffTime: string
  ): { isPreMatch: boolean; error?: string } {
    const snap = new Date(snapshotTime).getTime();
    const kickoff = new Date(matchKickoffTime).getTime();

    if (isNaN(snap)) {
      return { isPreMatch: false, error: 'Geçersiz oran anlık görüntü (snapshot) zamanı.' };
    }
    if (isNaN(kickoff)) {
      return { isPreMatch: false, error: 'Geçersiz maç başlama saati.' };
    }

    // Look-ahead bias check: snapshot must be prior to or at kickoff (allow max 2 min clock drift tolerance)
    if (snap > kickoff + 120000) {
      return {
        isPreMatch: false,
        error: `Look-ahead bias tespit edildi: Oran yakalama zamanı (${new Date(snap).toISOString()}) maç başlangıcından (${new Date(kickoff).toISOString()}) sonradır.`,
      };
    }

    return { isPreMatch: true };
  }

  /**
   * Item 120 & 121: Computes movements between an opening snapshot and a current snapshot
   */
  public static computeMovements(opening: OddsSnapshot, current: OddsSnapshot): OddsMovementItem[] {
    const movements: OddsMovementItem[] = [];

    const keys: Array<{ key: keyof OddsSnapshot['markets']; name: string; selection: string }> = [
      { key: 'ms1', name: 'Maç Sonucu', selection: 'MS 1' },
      { key: 'msX', name: 'Maç Sonucu', selection: 'MS X' },
      { key: 'ms2', name: 'Maç Sonucu', selection: 'MS 2' },
      { key: 'under25', name: '2.5 Gol', selection: '2.5 Alt' },
      { key: 'over25', name: '2.5 Gol', selection: '2.5 Üst' },
      { key: 'bttsYes', name: 'Karşılıklı Gol', selection: 'KG Var' },
      { key: 'bttsNo', name: 'Karşılıklı Gol', selection: 'KG Yok' },
      { key: 'dc1X', name: 'Çifte Şans', selection: '1X' },
      { key: 'dc12', name: 'Çifte Şans', selection: '12' },
      { key: 'dcX2', name: 'Çifte Şans', selection: 'X2' },
      { key: 'ht1', name: 'İlk Yarı', selection: 'İY 1' },
      { key: 'htX', name: 'İlk Yarı', selection: 'İY X' },
      { key: 'ht2', name: 'İlk Yarı', selection: 'İY 2' },
    ];

    // Compute time difference in hours for velocity
    const openTime = new Date(opening.timestamp).getTime();
    const curTime = new Date(current.timestamp).getTime();
    const hoursPassed = !isNaN(openTime) && !isNaN(curTime) && curTime > openTime ? (curTime - openTime) / 3600000 : 1;

    for (const item of keys) {
      const openVal = opening.markets[item.key];
      const curVal = current.markets[item.key];

      if (this.isValidOdd(openVal) && this.isValidOdd(curVal)) {
        const delta = Number((curVal! - openVal!).toFixed(2));
        const percentChange = Number((((curVal! - openVal!) / openVal!) * 100).toFixed(2));
        const movementVelocity = Number((delta / Math.max(0.1, hoursPassed)).toFixed(3));

        let direction: 'DOWN' | 'UP' | 'STABLE' = 'STABLE';
        let signalContext: 'STEAMING_IN' | 'DRIFTING_OUT' | 'NEUTRAL' = 'NEUTRAL';

        if (percentChange <= -2.0) {
          direction = 'DOWN';
          signalContext = 'STEAMING_IN';
        } else if (percentChange >= 2.0) {
          direction = 'UP';
          signalContext = 'DRIFTING_OUT';
        }

        movements.push({
          marketKey: String(item.key),
          marketName: item.name,
          selection: item.selection,
          openingOdd: openVal!,
          currentOdd: curVal!,
          delta,
          percentChange,
          direction,
          isSignificant: Math.abs(percentChange) >= 5.0,
          movementVelocity,
          signalContext,
        });
      }
    }

    return movements;
  }

  /**
   * Item 123 & 124: Calculates Probability Edge and Expected Value (EV) against bookmaker odds
   *
   * EV = (modelProbability * bookmakerOdd) - 1
   * Positive EV Filter: strictly EV > 0 (EV <= 0 cannot produce a value edge)
   */
  public static calculateProbabilityEdge(
    market: string,
    selection: string,
    bookmakerOdd: number,
    fairImpliedProbability: number,
    modelProbability: number
  ): ProbabilityEdgeResult {
    const rawImplied = Number((1 / bookmakerOdd).toFixed(4));
    const edge = Number((modelProbability - fairImpliedProbability).toFixed(4));
    const edgePercentage = Number((edge * 100).toFixed(2));

    // Expected Value: EV = (p * odd) - 1
    const rawEv = (modelProbability * bookmakerOdd) - 1;
    const ev = Number(rawEv.toFixed(4));

    // Positive EV rule: strictly EV > 0 (with epsilon)
    const isPositiveEv = ev > 0.0001;

    // A selection only has value if it possesses BOTH a positive EV and a positive mathematical edge
    const hasValue = isPositiveEv && edge > 0.0001;

    // Kelly Criterion calculation: f = (p * odd - 1) / (odd - 1)
    let kellyFraction: number | undefined = undefined;
    let halfKellyFraction: number | undefined = undefined;

    if (isPositiveEv && bookmakerOdd > 1.0) {
      const f = rawEv / (bookmakerOdd - 1.0);
      if (Number.isFinite(f) && f > 0) {
        kellyFraction = Number(Math.min(0.25, f).toFixed(4));
        halfKellyFraction = Number(Math.min(0.05, f * 0.5).toFixed(4));
      }
    }

    return {
      market,
      selection,
      bookmakerOdd,
      rawImpliedProbability: rawImplied,
      fairImpliedProbability,
      modelProbability,
      edge,
      edgePercentage,
      ev,
      isPositiveEv,
      hasValue,
      kellyFraction,
      halfKellyFraction,
      confidenceScore: Math.min(100, Math.max(0, Math.round((Math.max(0, edge) + 0.1) * 300))),
      riskNotice: 'İstatistiksel avantaj (edge) ve beklenen değer (EV) bir kazanç garantisi değildir; model ile piyasa arasındaki matematiksel farktır.',
    };
  }

  /**
   * Item 116: Converts flat markets map to canonical odds item array
   */
  public static toCanonicalOddsItems(
    matchId: string,
    provider: string,
    markets: OddsSnapshot['markets'],
    capturedAt: string
  ): CanonicalOddsItem[] {
    const items: CanonicalOddsItem[] = [];

    const mapKeys: Array<{ key: keyof OddsSnapshot['markets']; marketId: string; marketName: string; selId: string; selName: string }> = [
      { key: 'ms1', marketId: '1', marketName: 'Maç Sonucu', selId: '1', selName: 'MS 1' },
      { key: 'msX', marketId: '1', marketName: 'Maç Sonucu', selId: '2', selName: 'MS X' },
      { key: 'ms2', marketId: '1', marketName: 'Maç Sonucu', selId: '3', selName: 'MS 2' },
      { key: 'under25', marketId: '12', marketName: '2.5 Gol Alt/Üst', selId: '1', selName: '2.5 Alt' },
      { key: 'over25', marketId: '12', marketName: '2.5 Gol Alt/Üst', selId: '2', selName: '2.5 Üst' },
      { key: 'under15', marketId: '11', marketName: '1.5 Gol Alt/Üst', selId: '1', selName: '1.5 Alt' },
      { key: 'over15', marketId: '11', marketName: '1.5 Gol Alt/Üst', selId: '2', selName: '1.5 Üst' },
      { key: 'under35', marketId: '13', marketName: '3.5 Gol Alt/Üst', selId: '1', selName: '3.5 Alt' },
      { key: 'over35', marketId: '13', marketName: '3.5 Gol Alt/Üst', selId: '2', selName: '3.5 Üst' },
      { key: 'bttsYes', marketId: '49', marketName: 'Karşılıklı Gol', selId: '1', selName: 'KG Var' },
      { key: 'bttsNo', marketId: '49', marketName: 'Karşılıklı Gol', selId: '2', selName: 'KG Yok' },
      { key: 'dc1X', marketId: '3', marketName: 'Çifte Şans', selId: '1', selName: '1X' },
      { key: 'dc12', marketId: '3', marketName: 'Çifte Şans', selId: '2', selName: '12' },
      { key: 'dcX2', marketId: '3', marketName: 'Çifte Şans', selId: '3', selName: 'X2' },
      { key: 'ht1', marketId: '7', marketName: 'İlk Yarı Sonucu', selId: '1', selName: 'İY 1' },
      { key: 'htX', marketId: '7', marketName: 'İlk Yarı Sonucu', selId: '2', selName: 'İY X' },
      { key: 'ht2', marketId: '7', marketName: 'İlk Yarı Sonucu', selId: '3', selName: 'İY 2' },
    ];

    for (const item of mapKeys) {
      const odd = markets[item.key];
      if (this.isValidOdd(odd)) {
        items.push({
          matchId,
          provider,
          marketId: item.marketId,
          marketName: item.marketName,
          selectionId: item.selId,
          selectionName: item.selName,
          odds: odd!,
          impliedProbability: Number((1 / odd!).toFixed(4)),
          capturedAt,
          sourceStatus: 'valid',
        });
      }
    }

    return items;
  }

  /**
   * Item 119: Builds an immutable OddsSnapshot from raw market values
   */
  public static buildSnapshot(params: {
    matchId: string;
    source?: 'Nesine' | 'VerifiedBookmaker' | 'System' | string;
    markets: OddsSnapshot['markets'];
    isLive?: boolean;
    timestamp?: string;
  }): OddsSnapshot {
    const { matchId, source = 'Nesine', markets, isLive = false, timestamp = new Date().toISOString() } = params;

    // Overrounds
    const msOdds = [markets.ms1, markets.msX, markets.ms2].filter(this.isValidOdd) as number[];
    const msOverround = msOdds.length === 3 ? this.calculateOverround(msOdds) : { overroundPercent: 0, fairProbabilities: [] };

    const ouOdds = [markets.under25, markets.over25].filter(this.isValidOdd) as number[];
    const ouOverround = ouOdds.length === 2 ? this.calculateOverround(ouOdds) : { overroundPercent: 0, fairProbabilities: [] };

    const bttsOdds = [markets.bttsYes, markets.bttsNo].filter(this.isValidOdd) as number[];
    const bttsOverround = bttsOdds.length === 2 ? this.calculateOverround(bttsOdds) : { overroundPercent: 0, fairProbabilities: [] };

    const canonicalOdds = this.toCanonicalOddsItems(matchId, source, markets, timestamp);

    return {
      snapshotId: `snap_${matchId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      matchId,
      timestamp,
      source,
      isLive,
      canonicalOdds,
      markets,
      overround: {
        matchResult: msOverround.overroundPercent,
        overUnder25: ouOverround.overroundPercent,
        btts: bttsOverround.overroundPercent,
      },
      fairProbabilities: {
        homeWin: msOverround.fairProbabilities[0],
        draw: msOverround.fairProbabilities[1],
        awayWin: msOverround.fairProbabilities[2],
        under25: ouOverround.fairProbabilities[0],
        over25: ouOverround.fairProbabilities[1],
        bttsYes: bttsOverround.fairProbabilities[0],
        bttsNo: bttsOverround.fairProbabilities[1],
      },
    };
  }
}

