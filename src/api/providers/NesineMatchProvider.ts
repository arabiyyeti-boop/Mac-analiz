// src/api/providers/NesineMatchProvider.ts - Real Match & Odds Provider adapter for Nesine.com
import { FootballDataProvider, ProviderFixtureQuery, ProviderResult } from './FootballDataProvider';
import { NesineOddsProvider } from './NesineOddsProvider';
import { CanonicalMatch, CanonicalForm, CanonicalH2H, CanonicalStanding, CanonicalStats, CanonicalOdds } from '@/types';
import { canonicalEntityManager } from '@/entity/CanonicalEntityManager';

export class NesineMatchProvider implements FootballDataProvider {
  readonly name = 'Nesine';
  private nesineOdds = NesineOddsProvider.getInstance();

  isConfigured(): boolean {
    return true; // Production live bulletin endpoint is available
  }

  async getFixtures(query?: ProviderFixtureQuery): Promise<ProviderResult<CanonicalMatch[]>> {
    const start = Date.now();
    const rawEvents = await this.nesineOdds.fetchBulletin();

    const matches: CanonicalMatch[] = [];
    const now = Date.now();

    for (const ev of rawEvents) {
      if (!ev.HN || !ev.AN || !ev.C) continue;

      let utcDate = new Date().toISOString();
      let isPast = false;

      if (ev.ESD && typeof ev.ESD === 'number') {
        utcDate = new Date(ev.ESD).toISOString();
        isPast = ev.ESD < now;
      } else if (ev.D && ev.T) {
        const parts = ev.D.split('.');
        if (parts.length === 3) {
          const iso = `${parts[2]}-${parts[1]}-${parts[0]}T${ev.T}:00`;
          const parsed = new Date(iso).getTime();
          if (!isNaN(parsed)) {
            utcDate = new Date(parsed).toISOString();
            isPast = parsed < now;
          }
        }
      }

      // Filter query dates if specified
      if (query?.dateFrom && query?.dateTo) {
        const matchDateOnly = utcDate.split('T')[0];
        if (matchDateOnly < query.dateFrom || matchDateOnly > query.dateTo) {
          continue;
        }
      }

      // Resolve Home and Away Canonical Entities
      const homeRes = canonicalEntityManager.resolveTeam({ name: ev.HN });
      const awayRes = canonicalEntityManager.resolveTeam({ name: ev.AN });

      const homeCanonicalId = homeRes.team?.canonicalTeamId || `dyn_${ev.HN}`;
      const awayCanonicalId = awayRes.team?.canonicalTeamId || `dyn_${ev.AN}`;

      // Prevent corrupted matches where home equals away
      if (homeCanonicalId === awayCanonicalId) continue;

      const homeLogo = canonicalEntityManager.verifyLogo(ev.HN, homeRes.team?.logoUrl);
      const awayLogo = canonicalEntityManager.verifyLogo(ev.AN, awayRes.team?.logoUrl);

      // Extract Odds from Market Array (MTID 1 = MS, MTID 12 = 2.5 Alt/Üst)
      let canonicalOdds: CanonicalOdds | undefined;
      if (ev.MA && ev.MA.length > 0) {
        const msMarket = ev.MA.find((m) => m.MTID === 1);
        const ouMarket = ev.MA.find((m) => m.MTID === 12 && m.SOV === 2.5);

        const o1 = msMarket?.OCA?.find((o) => o.N === 1)?.O;
        const oX = msMarket?.OCA?.find((o) => o.N === 2)?.O;
        const o2 = msMarket?.OCA?.find((o) => o.N === 3)?.O;
        const oUnder = ouMarket?.OCA?.find((o) => o.N === 1)?.O;
        const oOver = ouMarket?.OCA?.find((o) => o.N === 2)?.O;

        if (o1 && oX && o2 && o1 > 1.01 && oX > 1.01 && o2 > 1.01) {
          canonicalOdds = {
            bookmaker: 'Nesine',
            homeWin: o1,
            draw: oX,
            awayWin: o2,
            over25: oOver && oOver > 1.01 ? oOver : undefined,
            under25: oUnder && oUnder > 1.01 ? oUnder : undefined,
            retrievedAt: new Date().toISOString(),
          };
        }
      }

      const match: CanonicalMatch = {
        id: `nesine_${ev.C}`,
        externalId: String(ev.C),
        provider: 'Nesine',
        utcDate,
        status: isPast ? 'FINISHED' : 'SCHEDULED',
        homeTeam: {
          id: homeCanonicalId,
          name: homeRes.team?.officialName || ev.HN,
          shortName: homeLogo.fallbackInitials || ev.HN.substring(0, 3).toUpperCase(),
          crest: homeLogo.effectiveLogoUrl,
        },
        awayTeam: {
          id: awayCanonicalId,
          name: awayRes.team?.officialName || ev.AN,
          shortName: awayLogo.fallbackInitials || ev.AN.substring(0, 3).toUpperCase(),
          crest: awayLogo.effectiveLogoUrl,
        },
        league: {
          id: 'nesine_bulten',
          name: 'Nesine Futbol Bülteni',
          code: 'NESINE',
          country: homeRes.team?.country || 'Global',
        },
        odds: canonicalOdds,
      };

      matches.push(match);
    }

    return {
      data: matches,
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
        rawCount: rawEvents.length,
      },
    };
  }

  async getMatchDetails(matchId: string): Promise<ProviderResult<{
    match: CanonicalMatch;
    homeForm?: CanonicalForm;
    awayForm?: CanonicalForm;
    h2h?: CanonicalH2H;
    standing?: { home?: CanonicalStanding; away?: CanonicalStanding };
    stats?: CanonicalStats;
    odds?: CanonicalOdds;
  }>> {
    const start = Date.now();
    const fixturesRes = await this.getFixtures();
    const match = fixturesRes.data.find((m) => m.id === matchId || m.externalId === matchId);

    if (!match) {
      throw new Error(`FIXTURE_NOT_FOUND: Nesine bülteninde "${matchId}" numaralı maç bulunamadı.`);
    }

    return {
      data: {
        match,
        odds: match.odds,
        h2h: {
          status: 'MISSING',
          matchesCount: 0,
          homeWins: 0,
          draws: 0,
          awayWins: 0,
          totalGoals: 0,
          avgGoals: 0,
          recentMatches: [],
          source: this.name,
          retrievedAt: new Date().toISOString(),
          confidence: 0,
        },
      },
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
        rawCount: 1,
      },
    };
  }

  async getStandings(): Promise<ProviderResult<CanonicalStanding[]>> {
    return {
      data: [],
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs: 0,
        rawCount: 0,
      },
    };
  }

  async getH2H(homeTeamId: string | number, awayTeamId: string | number): Promise<ProviderResult<CanonicalH2H>> {
    return {
      data: {
        status: 'MISSING',
        matchesCount: 0,
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        totalGoals: 0,
        avgGoals: 0,
        recentMatches: [],
        source: this.name,
        retrievedAt: new Date().toISOString(),
        confidence: 0,
      },
      provenance: {
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        latencyMs: 0,
        rawCount: 0,
      },
    };
  }
}
