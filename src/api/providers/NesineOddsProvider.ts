// src/api/providers/NesineOddsProvider.ts - Production Nesine Bulletin & Odds Integration
import {
  NesineMatchOddsData,
  NesineMarket,
  NesineAvailability,
  OddsSnapshot,
  OddsHistory,
  OddsMovementItem,
  OddsProvider,
  OddsMatchQuery,
  OddsMatch,
  OddsMarketItem,
  OddsSourceProvenance,
} from '@/types/odds';
import { OddsMovementEngine } from '@/analysis/oddsMovement';
import { TeamIdentityService } from '@/analysis/teamIdentity';
import { canonicalEntityManager } from '@/entity/CanonicalEntityManager';

const NESINE_AUTH_HEADER = 'Basic RDQ3MDc4RDMtNjcwQi00OUJBLTgxNUYtM0IyMjI2MTM1MTZCOkI4MzJCQjZGLTQwMjgtNDIwNS05NjFELTg1N0QxRTZEOTk0OA==';
const PRIMARY_BULLETIN_URL = 'https://bulten.nesine.com/api/bulten/getprebultenfull';
const FALLBACK_BULLETIN_URL = 'https://cdnbulten.nesine.com/api/bulten/getprebultenfull';

interface NesineRawOutcome {
  N: number;
  O: number;
}

interface NesineRawMarket {
  ID: number;
  NO: number;
  MTID: number;
  SOV?: number;
  OCA?: NesineRawOutcome[];
}

interface NesineRawEvent {
  C: number;
  HN?: string;
  AN?: string;
  D?: string; // DD.MM.YYYY
  T?: string; // HH:MM
  ESD?: number; // timestamp
  TYPE?: number;
  MA?: NesineRawMarket[];
}

export class NesineOddsProvider implements OddsProvider {
  public readonly name = 'Nesine';
  private static instance: NesineOddsProvider;
  private cachedBulletin: NesineRawEvent[] | null = null;
  private lastFetchTime = 0;
  private cacheTtlMs = 120000; // 2 minutes
  private isFetching = false;
  private status: NesineAvailability = 'CONNECTED';
  private lastError: string | null = null;

  // In-memory snapshots store with strict memory bounding
  private snapshotStore = new Map<string, { snapshots: OddsSnapshot[]; lastAccess: number }>();
  private readonly MAX_STORED_MATCHES = 150;
  private readonly MAX_SNAPSHOTS_PER_MATCH = 20;
  private readonly SNAPSHOT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  public static getInstance(): NesineOddsProvider {
    if (!NesineOddsProvider.instance) {
      NesineOddsProvider.instance = new NesineOddsProvider();
    }
    return NesineOddsProvider.instance;
  }

  /**
   * Prunes snapshotStore to prevent memory leaks over extended operation
   */
  private pruneSnapshotStore(): void {
    const now = Date.now();

    // 1. Remove expired matches (> 24h)
    for (const [matchId, entry] of this.snapshotStore.entries()) {
      if (now - entry.lastAccess > this.SNAPSHOT_RETENTION_MS) {
        this.snapshotStore.delete(matchId);
      }
    }

    // 2. If count still exceeds max limit, evict oldest accessed
    if (this.snapshotStore.size > this.MAX_STORED_MATCHES) {
      const sortedEntries = Array.from(this.snapshotStore.entries()).sort(
        (a, b) => a[1].lastAccess - b[1].lastAccess
      );
      const toRemove = sortedEntries.slice(0, this.snapshotStore.size - this.MAX_STORED_MATCHES);
      for (const [id] of toRemove) {
        this.snapshotStore.delete(id);
      }
    }
  }

  public getStatus(): { status: NesineAvailability; lastFetch: string | null; error: string | null; totalEvents: number } {
    return {
      status: this.status,
      lastFetch: this.lastFetchTime ? new Date(this.lastFetchTime).toISOString() : null,
      error: this.lastError,
      totalEvents: this.cachedBulletin?.length || 0,
    };
  }

  /**
   * Fetches the entire Nesine live bulletin
   */
  public async fetchBulletin(forceRefresh = false): Promise<NesineRawEvent[]> {
    if (!forceRefresh && this.cachedBulletin && Date.now() - this.lastFetchTime < this.cacheTtlMs) {
      return this.cachedBulletin;
    }

    if (this.isFetching) {
      // Return existing cache or wait briefly
      if (this.cachedBulletin) return this.cachedBulletin;
      await new Promise((r) => setTimeout(r, 800));
      if (this.cachedBulletin) return this.cachedBulletin;
    }

    this.isFetching = true;
    try {
      const urls = [PRIMARY_BULLETIN_URL, FALLBACK_BULLETIN_URL];
      let data: any = null;
      let lastErr: Error | null = null;

      for (const url of urls) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: NESINE_AUTH_HEADER,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'application/json, text/plain, */*',
            },
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (res.ok) {
            data = await res.json();
            break;
          } else if (res.status === 429) {
            this.status = 'RATE_LIMITED';
            throw new Error(`Nesine rate limit exceeded (HTTP ${res.status})`);
          }
        } catch (err: any) {
          lastErr = err;
        }
      }

      if (!data || !data.sg || !Array.isArray(data.sg.EA)) {
        throw lastErr || new Error('Nesine bülten verisi ayrıştırılamadı (Geçersiz yanıt yapısı).');
      }

      // Filter football events with teams
      const footballEvents: NesineRawEvent[] = data.sg.EA.filter(
        (e: NesineRawEvent) => e.TYPE === 1 && e.HN && e.AN
      );

      this.cachedBulletin = footballEvents;
      this.lastFetchTime = Date.now();
      this.status = 'CONNECTED';
      this.lastError = null;

      return footballEvents;
    } catch (err: any) {
      this.status = 'NESINE_UNAVAILABLE';
      this.lastError = err.message || 'Nesine bağlantısı kurulamadı.';
      throw err;
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Item 113: OddsProvider implementation - getMatches
   * Item 114: Only unstarted / scheduled matches
   */
  public async getMatches(params: OddsMatchQuery = {}): Promise<{
    data: OddsMatch[];
    provenance: OddsSourceProvenance;
  }> {
    const startTime = Date.now();
    try {
      const bulletin = await this.fetchBulletin();
      const now = Date.now();

      const matches: OddsMatch[] = [];

      for (const event of bulletin) {
        if (!event.HN || !event.AN) continue;

        // Parse kickoff timestamp
        let kickoffDateStr = '';
        let isPast = false;
        if (event.ESD && typeof event.ESD === 'number') {
          kickoffDateStr = new Date(event.ESD).toISOString();
          isPast = event.ESD < now;
        } else if (event.D && event.T) {
          const parts = event.D.split('.');
          if (parts.length === 3) {
            const iso = `${parts[2]}-${parts[1]}-${parts[0]}T${event.T}:00`;
            kickoffDateStr = new Date(iso).toISOString();
            isPast = new Date(iso).getTime() < now;
          }
        }

        // Item 114: Filter out started/finished matches from unstarted pre-match bulletin
        if (isPast) {
          continue;
        }

        matches.push({
          matchId: `nesine_${event.C}`,
          sourceMatchId: String(event.C),
          provider: 'Nesine',
          league: 'Nesine Bülten',
          homeTeam: event.HN,
          awayTeam: event.AN,
          kickoff: kickoffDateStr || new Date().toISOString(),
          status: 'SCHEDULED',
          isLive: false,
          marketCount: event.MA?.length || 0,
        });
      }

      return {
        data: matches,
        provenance: {
          provider: 'Nesine',
          source: 'https://bulten.nesine.com',
          retrievedAt: new Date().toISOString(),
          capturedAt: new Date(this.lastFetchTime || Date.now()).toISOString(),
          validationStatus: 'VALID',
          freshness: OddsMovementEngine.checkFreshness(new Date(this.lastFetchTime).toISOString()),
          rawCount: bulletin.length,
          latencyMs: Date.now() - startTime,
        },
      };
    } catch {
      return {
        data: [],
        provenance: {
          provider: 'Nesine',
          source: 'UNAVAILABLE',
          retrievedAt: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
          validationStatus: 'INVALID',
          freshness: 'UNAVAILABLE',
          rawCount: 0,
          latencyMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Item 113: OddsProvider implementation - getMarkets
   */
  public async getMarkets(matchId: string): Promise<{
    data: OddsMarketItem[];
    provenance: OddsSourceProvenance;
  }> {
    const startTime = Date.now();
    const oddsData = await this.getOddsForMatch(matchId, '', '');
    const items: OddsMarketItem[] = oddsData.markets.map((m) => ({
      marketId: String(m.marketId),
      marketTypeId: m.marketTypeId,
      marketName: m.marketName,
      sov: m.sov,
      outcomes: m.outcomes.map((o) => ({
        selectionId: String(o.id),
        selectionName: o.name,
        odds: o.odd,
        impliedProbability: Number((1 / o.odd).toFixed(4)),
      })),
      overround: m.overround,
      fairProbabilities: m.fairProbabilities,
      status: 'active',
    }));

    return {
      data: items,
      provenance: {
        provider: 'Nesine',
        source: 'https://bulten.nesine.com',
        retrievedAt: new Date().toISOString(),
        capturedAt: oddsData.retrievedAt,
        validationStatus: oddsData.status === 'CONNECTED' ? 'VALID' : 'INVALID',
        freshness: OddsMovementEngine.checkFreshness(oddsData.retrievedAt),
        latencyMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Item 113: OddsProvider implementation - getOdds
   */
  public async getOdds(matchId: string): Promise<{
    data: OddsSnapshot;
    provenance: OddsSourceProvenance;
  }> {
    const startTime = Date.now();
    const oddsData = await this.getOddsForMatch(matchId, '', '');
    return {
      data: oddsData.snapshot,
      provenance: {
        provider: 'Nesine',
        source: 'https://bulten.nesine.com',
        retrievedAt: new Date().toISOString(),
        capturedAt: oddsData.snapshot.timestamp,
        validationStatus: oddsData.status === 'CONNECTED' ? 'VALID' : 'INVALID',
        freshness: OddsMovementEngine.checkFreshness(oddsData.snapshot.timestamp),
        latencyMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Finds odds for a given home and away team
   */
  public async getOddsForMatch(
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    modelProbs?: { home?: number; draw?: number; away?: number; over25?: number; btts?: number }
  ): Promise<NesineMatchOddsData> {
    try {
      const bulletin = await this.fetchBulletin();

      // 1. Check exact ID match if matchId is derived from Nesine code
      let bestMatch: NesineRawEvent | null = null;
      const nesineCode = matchId.startsWith('nesine_') ? matchId.replace('nesine_', '') : (matchId.match(/\d+$/) ? matchId.match(/\d+$/)![0] : null);

      if (nesineCode) {
        bestMatch = bulletin.find((ev) => String(ev.C) === nesineCode) || null;
      }

      // 2. Canonical Identity Resolution Lookup
      if (!bestMatch && homeTeam && awayTeam) {
        const targetHome = canonicalEntityManager.resolveTeam({ name: homeTeam });
        const targetAway = canonicalEntityManager.resolveTeam({ name: awayTeam });

        // A. Exact Canonical Team IDs Match
        if (targetHome.team && targetAway.team && targetHome.team.canonicalTeamId !== targetAway.team.canonicalTeamId) {
          for (const event of bulletin) {
            if (!event.HN || !event.AN) continue;
            const evHome = canonicalEntityManager.resolveTeam({ name: event.HN });
            const evAway = canonicalEntityManager.resolveTeam({ name: event.AN });

            if (
              evHome.team &&
              evAway.team &&
              evHome.team.canonicalTeamId === targetHome.team.canonicalTeamId &&
              evAway.team.canonicalTeamId === targetAway.team.canonicalTeamId
            ) {
              bestMatch = event;
              break;
            }
          }
        }

        // B. High-Confidence Strict Match Fallback (>= 0.78 threshold)
        if (!bestMatch) {
          let highestScore = 0;
          for (const event of bulletin) {
            if (!event.HN || !event.AN) continue;
            const homeConf = TeamIdentityService.matchConfidence(homeTeam, event.HN);
            const awayConf = TeamIdentityService.matchConfidence(awayTeam, event.AN);
            const totalScore = (homeConf + awayConf) / 2;

            if (homeConf >= 0.78 && awayConf >= 0.78 && totalScore > highestScore) {
              highestScore = totalScore;
              bestMatch = event;
            }
          }
        }
      }

      if (!bestMatch || !bestMatch.MA || bestMatch.MA.length === 0) {
        return {
          status: 'NESINE_UNAVAILABLE',
          source: 'UNAVAILABLE',
          retrievedAt: new Date().toISOString(),
          markets: [],
          snapshot: OddsMovementEngine.buildSnapshot({ matchId, markets: {} }),
          edges: [],
          diagnosticMessage: `Nesine bülteninde "${homeTeam} - ${awayTeam}" karşılaşması için aktif bahis marketi bulunamadı.`,
        };
      }

      // Parse Nesine markets
      const parsedMarkets: NesineMarket[] = [];
      const snapshotMarkets: OddsSnapshot['markets'] = {};

      for (const m of bestMatch.MA) {
        if (!m.OCA || m.OCA.length === 0) continue;

        // MTID 1: Maç Sonucu
        if (m.MTID === 1) {
          const o1 = m.OCA.find((o) => o.N === 1)?.O;
          const oX = m.OCA.find((o) => o.N === 2)?.O;
          const o2 = m.OCA.find((o) => o.N === 3)?.O;

          if (OddsMovementEngine.isValidOdd(o1) && OddsMovementEngine.isValidOdd(oX) && OddsMovementEngine.isValidOdd(o2)) {
            snapshotMarkets.ms1 = o1;
            snapshotMarkets.msX = oX;
            snapshotMarkets.ms2 = o2;

            const overround = OddsMovementEngine.calculateOverround([o1, oX, o2]);
            parsedMarkets.push({
              marketId: m.ID,
              marketTypeId: 1,
              marketName: 'Maç Sonucu (MS)',
              outcomes: [
                { id: 1, name: 'MS 1', odd: o1, oddFormatted: o1.toFixed(2) },
                { id: 2, name: 'MS X', odd: oX, oddFormatted: oX.toFixed(2) },
                { id: 3, name: 'MS 2', odd: o2, oddFormatted: o2.toFixed(2) },
              ],
              overround: overround.overroundPercent,
              fairProbabilities: {
                'MS 1': overround.fairProbabilities[0],
                'MS X': overround.fairProbabilities[1],
                'MS 2': overround.fairProbabilities[2],
              },
            });
          }
        }

        // MTID 12: 2.5 Gol Alt/Üst
        if (m.MTID === 12 && m.SOV === 2.5) {
          const alt = m.OCA.find((o) => o.N === 1)?.O;
          const ust = m.OCA.find((o) => o.N === 2)?.O;

          if (OddsMovementEngine.isValidOdd(alt) && OddsMovementEngine.isValidOdd(ust)) {
            snapshotMarkets.under25 = alt;
            snapshotMarkets.over25 = ust;

            const overround = OddsMovementEngine.calculateOverround([alt, ust]);
            parsedMarkets.push({
              marketId: m.ID,
              marketTypeId: 12,
              marketName: '2.5 Gol Alt/Üst',
              sov: 2.5,
              outcomes: [
                { id: 1, name: '2.5 Alt', odd: alt, oddFormatted: alt.toFixed(2) },
                { id: 2, name: '2.5 Üst', odd: ust, oddFormatted: ust.toFixed(2) },
              ],
              overround: overround.overroundPercent,
              fairProbabilities: {
                '2.5 Alt': overround.fairProbabilities[0],
                '2.5 Üst': overround.fairProbabilities[1],
              },
            });
          }
        }

        // MTID 49: Karşılıklı Gol Var/Yok
        if (m.MTID === 49) {
          const varOdd = m.OCA.find((o) => o.N === 1)?.O;
          const yokOdd = m.OCA.find((o) => o.N === 2)?.O;

          if (OddsMovementEngine.isValidOdd(varOdd) && OddsMovementEngine.isValidOdd(yokOdd)) {
            snapshotMarkets.bttsYes = varOdd;
            snapshotMarkets.bttsNo = yokOdd;

            const overround = OddsMovementEngine.calculateOverround([varOdd, yokOdd]);
            parsedMarkets.push({
              marketId: m.ID,
              marketTypeId: 49,
              marketName: 'Karşılıklı Gol (KG)',
              outcomes: [
                { id: 1, name: 'KG Var', odd: varOdd, oddFormatted: varOdd.toFixed(2) },
                { id: 2, name: 'KG Yok', odd: yokOdd, oddFormatted: yokOdd.toFixed(2) },
              ],
              overround: overround.overroundPercent,
              fairProbabilities: {
                'KG Var': overround.fairProbabilities[0],
                'KG Yok': overround.fairProbabilities[1],
              },
            });
          }
        }

        // MTID 3: Çifte Şans
        if (m.MTID === 3) {
          const cs1X = m.OCA.find((o) => o.N === 1)?.O;
          const cs12 = m.OCA.find((o) => o.N === 2)?.O;
          const csX2 = m.OCA.find((o) => o.N === 3)?.O;

          if (cs1X && cs12 && csX2) {
            snapshotMarkets.dc1X = cs1X;
            snapshotMarkets.dc12 = cs12;
            snapshotMarkets.dcX2 = csX2;

            parsedMarkets.push({
              marketId: m.ID,
              marketTypeId: 3,
              marketName: 'Çifte Şans (ÇŞ)',
              outcomes: [
                { id: 1, name: '1-X', odd: cs1X, oddFormatted: cs1X.toFixed(2) },
                { id: 2, name: '1-2', odd: cs12, oddFormatted: cs12.toFixed(2) },
                { id: 3, name: 'X-2', odd: csX2, oddFormatted: csX2.toFixed(2) },
              ],
              overround: 0,
              fairProbabilities: {},
            });
          }
        }

        // MTID 7: İlk Yarı Sonucu
        if (m.MTID === 7) {
          const ht1 = m.OCA.find((o) => o.N === 1)?.O;
          const htX = m.OCA.find((o) => o.N === 2)?.O;
          const ht2 = m.OCA.find((o) => o.N === 3)?.O;

          if (ht1 && htX && ht2) {
            snapshotMarkets.ht1 = ht1;
            snapshotMarkets.htX = htX;
            snapshotMarkets.ht2 = ht2;

            parsedMarkets.push({
              marketId: m.ID,
              marketTypeId: 7,
              marketName: 'İlk Yarı Sonucu (İY)',
              outcomes: [
                { id: 1, name: 'İY 1', odd: ht1, oddFormatted: ht1.toFixed(2) },
                { id: 2, name: 'İY X', odd: htX, oddFormatted: htX.toFixed(2) },
                { id: 3, name: 'İY 2', odd: ht2, oddFormatted: ht2.toFixed(2) },
              ],
              overround: 0,
              fairProbabilities: {},
            });
          }
        }
      }

      // Build Snapshot
      const currentSnapshot = OddsMovementEngine.buildSnapshot({
        matchId,
        source: 'Nesine',
        markets: snapshotMarkets,
        isLive: false,
      });

      // Memory-bounded update in snapshotStore
      this.pruneSnapshotStore();
      const existingEntry = this.snapshotStore.get(matchId);
      const historyList = existingEntry ? existingEntry.snapshots : [];

      if (historyList.length === 0) {
        historyList.push(currentSnapshot);
      } else {
        const lastSnap = historyList[historyList.length - 1];
        if (JSON.stringify(lastSnap.markets) !== JSON.stringify(currentSnapshot.markets)) {
          historyList.push(currentSnapshot);
          // Limit snapshots per match to MAX_SNAPSHOTS_PER_MATCH
          if (historyList.length > this.MAX_SNAPSHOTS_PER_MATCH) {
            historyList.shift();
          }
        }
      }
      this.snapshotStore.set(matchId, { snapshots: historyList, lastAccess: Date.now() });

      const openingOdds = historyList[0];
      const movements = historyList.length > 1 ? OddsMovementEngine.computeMovements(openingOdds, currentSnapshot) : [];

      const oddsHistory: OddsHistory = {
        matchId,
        source: 'Nesine.com',
        lastUpdated: currentSnapshot.timestamp,
        openingOdds,
        currentOdds: currentSnapshot,
        snapshots: historyList,
        movements,
      };

      // Compute probability edges if model probabilities passed
      const edges = [];
      if (modelProbs?.home && currentSnapshot.markets.ms1 && currentSnapshot.fairProbabilities.homeWin) {
        edges.push(
          OddsMovementEngine.calculateProbabilityEdge(
            'Maç Sonucu',
            'MS 1',
            currentSnapshot.markets.ms1,
            currentSnapshot.fairProbabilities.homeWin,
            modelProbs.home
          )
        );
      }
      if (modelProbs?.away && currentSnapshot.markets.ms2 && currentSnapshot.fairProbabilities.awayWin) {
        edges.push(
          OddsMovementEngine.calculateProbabilityEdge(
            'Maç Sonucu',
            'MS 2',
            currentSnapshot.markets.ms2,
            currentSnapshot.fairProbabilities.awayWin,
            modelProbs.away
          )
        );
      }
      if (modelProbs?.over25 && currentSnapshot.markets.over25 && currentSnapshot.fairProbabilities.over25) {
        edges.push(
          OddsMovementEngine.calculateProbabilityEdge(
            '2.5 Gol',
            '2.5 Üst',
            currentSnapshot.markets.over25,
            currentSnapshot.fairProbabilities.over25,
            modelProbs.over25
          )
        );
      }

      return {
        nesineEventCode: bestMatch.C,
        status: 'CONNECTED',
        source: 'Nesine',
        retrievedAt: currentSnapshot.timestamp,
        markets: parsedMarkets,
        snapshot: currentSnapshot,
        history: oddsHistory,
        edges,
      };
    } catch (err: any) {
      return {
        status: 'NESINE_UNAVAILABLE',
        source: 'UNAVAILABLE',
        retrievedAt: new Date().toISOString(),
        markets: [],
        snapshot: OddsMovementEngine.buildSnapshot({ matchId, markets: {} }),
        edges: [],
        diagnosticMessage: err.message || 'Nesine servisine erişilemedi.',
      };
    }
  }
}
