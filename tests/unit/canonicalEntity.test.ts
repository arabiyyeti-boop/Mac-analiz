// tests/unit/canonicalEntity.test.ts - Unit Tests for Canonical Entity, Fixture & Integrity Guards
import { describe, it, expect } from 'vitest';
import { canonicalEntityManager } from '../../src/entity/CanonicalEntityManager';
import { CanonicalMatch, CanonicalH2H } from '../../src/types';
import { NesineMatchOddsData } from '../../src/types/odds';

describe('CanonicalEntityManager - Team Identity & Normalization', () => {
  it('should normalize Turkish and European club names consistently', () => {
    expect(canonicalEntityManager.normalizeName('Galatasaray A.Ş.')).toBe('galatasaray');
    expect(canonicalEntityManager.normalizeName('Fenerbahçe SK')).toBe('fenerbahce');
    expect(canonicalEntityManager.normalizeName('Beşiktaş J.K.')).toBe('besiktas');
    expect(canonicalEntityManager.normalizeName('Manchester City FC')).toBe('manchester');
    expect(canonicalEntityManager.normalizeName('Real Madrid CF')).toBe('real madrid');
  });

  it('should resolve known teams to exact canonical team records', () => {
    const gs = canonicalEntityManager.resolveTeam({ name: 'Galatasaray SK' });
    expect(gs.team).not.toBeNull();
    expect(gs.team?.canonicalTeamId).toBe('tr_galatasaray');
    expect(gs.team?.officialName).toBe('Galatasaray Spor Kulübü');
    expect(gs.confidence).toBeGreaterThanOrEqual(0.95);

    const fb = canonicalEntityManager.resolveTeam({ name: 'Fenerbahçe' });
    expect(fb.team).not.toBeNull();
    expect(fb.team?.canonicalTeamId).toBe('tr_fenerbahce');

    const bjk = canonicalEntityManager.resolveTeam({ name: 'Besiktas JK' });
    expect(bjk.team).not.toBeNull();
    expect(bjk.team?.canonicalTeamId).toBe('tr_besiktas');
  });

  it('should reject empty team names with zero confidence', () => {
    const res = canonicalEntityManager.resolveTeam({ name: '' });
    expect(res.team).toBeNull();
    expect(res.confidence).toBe(0);
    expect(res.reason).toBe('EMPTY_TEAM_NAME');
  });

  it('should distinguish teams with same name in different countries', () => {
    const liverpoolUruguay = canonicalEntityManager.resolveTeam({
      name: 'Liverpool',
      country: 'Uruguay',
    });
    // Liverpool FC in canonical store is England, so country conflict is flagged
    expect(liverpoolUruguay.confidence).toBeLessThan(0.70);
  });
});

describe('CanonicalEntityManager - Fixture Fingerprinting & Wrong Match Guard', () => {
  it('should generate deterministic fingerprints', () => {
    const fp1 = canonicalEntityManager.generateFingerprint('tr_galatasaray', 'tr_fenerbahce', '2026-09-15T19:00:00Z', 'superlig');
    const fp2 = canonicalEntityManager.generateFingerprint('tr_galatasaray', 'tr_fenerbahce', '2026-09-15T19:00:00Z', 'superlig');
    expect(fp1).toBe(fp2);
  });

  it('should reject corrupted matches where home equals away', () => {
    const corruptedMatch: CanonicalMatch = {
      id: 'test_corrupted',
      externalId: '123',
      provider: 'TestProvider',
      utcDate: '2026-09-15T19:00:00Z',
      status: 'SCHEDULED',
      homeTeam: { id: 'tr_galatasaray', name: 'Galatasaray', shortName: 'GS' },
      awayTeam: { id: 'tr_galatasaray', name: 'Galatasaray SK', shortName: 'GS' },
      league: { id: 'tr_superlig', name: 'Süper Lig', code: 'TR1' },
    };

    const validation = canonicalEntityManager.validateFixtureIdentity(corruptedMatch);
    expect(validation.isValid).toBe(false);
    expect(validation.issues.some((i) => i.includes('Kritik Entity Hatası'))).toBe(true);
  });
});

describe('CanonicalEntityManager - Wrong Logo Guard (Sections 11, 12, 87, 242)', () => {
  it('should verify legitimate team crest', () => {
    const res = canonicalEntityManager.verifyLogo('Galatasaray', 'https://crests.football-data.org/610.png');
    expect(res.isVerified).toBe(true);
    expect(res.conflictDetected).toBe(false);
    expect(res.canonicalTeamId).toBe('tr_galatasaray');
  });

  it('should detect LOGO_IDENTITY_CONFLICT when crest belongs to another club', () => {
    // Pass Fenerbahçe (600) crest for Galatasaray
    const res = canonicalEntityManager.verifyLogo('Galatasaray', 'https://crests.football-data.org/600.png');
    expect(res.conflictDetected).toBe(true);
    expect(res.conflictReason).toContain('LOGO_IDENTITY_CONFLICT');
    // Suppresses foreign crest, returns verified club logo or monogram fallback
    expect(res.effectiveLogoUrl).toBe('https://crests.football-data.org/610.png');
    expect(res.fallbackInitials).toBe('GS');
  });
});

describe('CanonicalEntityManager - Wrong Odds Guard & Stale Data Guard (Sections 88, 248)', () => {
  const targetFixture: CanonicalMatch = {
    id: 'nesine_1001',
    externalId: '1001',
    provider: 'Nesine',
    utcDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
    status: 'SCHEDULED',
    homeTeam: { id: 'tr_galatasaray', name: 'Galatasaray', shortName: 'GS' },
    awayTeam: { id: 'tr_fenerbahce', name: 'Fenerbahçe', shortName: 'FB' },
    league: { id: 'tr_superlig', name: 'Süper Lig', code: 'TR1' },
  };

  it('should reject odds when team names belong to different clubs', () => {
    const mockOddsData: NesineMatchOddsData = {
      status: 'CONNECTED',
      source: 'Nesine',
      retrievedAt: new Date().toISOString(),
      markets: [{ marketId: 1, marketTypeId: 1, marketName: 'MS', outcomes: [], overround: 5, fairProbabilities: {} }],
      snapshot: { snapshotId: 's1', overround: { matchResult: 5 }, matchId: 'nesine_9999', timestamp: new Date().toISOString(), source: 'Nesine', markets: {}, isLive: false, fairProbabilities: {} },
      edges: [],
    };

    const res = canonicalEntityManager.verifyOddsBinding(
      targetFixture,
      mockOddsData,
      'Arsenal',
      'Chelsea'
    );

    expect(res.isValid).toBe(false);
    expect(res.reasonCode).toBe('ODDS_TEAM_MISMATCH');
  });

  it('should reject stale odds (> 6 hours old)', () => {
    const staleTime = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    const mockOddsData: NesineMatchOddsData = {
      status: 'CONNECTED',
      source: 'Nesine',
      retrievedAt: staleTime,
      markets: [{ marketId: 1, marketTypeId: 1, marketName: 'MS', outcomes: [], overround: 5, fairProbabilities: {} }],
      snapshot: { snapshotId: 's2', overround: { matchResult: 5 }, matchId: 'nesine_1001', timestamp: staleTime, source: 'Nesine', markets: {}, isLive: false, fairProbabilities: {} },
      edges: [],
    };

    const res = canonicalEntityManager.verifyOddsBinding(
      targetFixture,
      mockOddsData,
      'Galatasaray',
      'Fenerbahçe'
    );

    expect(res.isValid).toBe(false);
    expect(res.reasonCode).toBe('ODDS_STALE');
    expect(res.isStale).toBe(true);
  });
});

describe('CanonicalEntityManager - Wrong H2H Guard (Section 90)', () => {
  const targetFixture: CanonicalMatch = {
    id: 'cf_1',
    externalId: '1',
    provider: 'Nesine',
    utcDate: new Date().toISOString(),
    status: 'SCHEDULED',
    homeTeam: { id: 'tr_galatasaray', name: 'Galatasaray', shortName: 'GS' },
    awayTeam: { id: 'tr_fenerbahce', name: 'Fenerbahçe', shortName: 'FB' },
    league: { id: 'tr_superlig', name: 'Süper Lig', code: 'TR1' },
  };

  it('should filter out H2H matches involving unrelated teams', () => {
    const mixedH2H: CanonicalH2H = {
      matchesCount: 2,
      homeWins: 1,
      draws: 0,
      awayWins: 1,
      totalGoals: 4,
      avgGoals: 2.0,
      recentMatches: [
        { date: '2025-05-10', homeTeam: 'Galatasaray', awayTeam: 'Fenerbahçe', homeScore: 2, awayScore: 1 },
        { date: '2025-04-01', homeTeam: 'Galatasaray', awayTeam: 'Beşiktaş', homeScore: 1, awayScore: 0 }, // Unrelated match!
      ],
    };

    const res = canonicalEntityManager.verifyH2HBinding(targetFixture, mixedH2H);
    expect(res.rejectedMatchesCount).toBe(1);
    expect(res.validMatchesCount).toBe(1);
    expect(res.diagnosticMessage).toContain('WRONG_H2H_GUARD');
  });
});

describe('Critical Verification: Team Identity, Odds Gate, Rescheduled Lineage & Provider Index', () => {
  it('1. TEAM IDENTITY: should not falsely match distinct clubs sharing substrings', async () => {
    const { TeamIdentityService } = await import('../../src/analysis/teamIdentity');
    
    // Manchester City vs Manchester United share 'Manchester', but must NOT match
    const manchesterConf = TeamIdentityService.matchConfidence('Manchester City', 'Manchester United');
    expect(manchesterConf).toBe(0);

    // Real Madrid vs Atletico Madrid share 'Madrid', but must NOT match
    const madridConf = TeamIdentityService.matchConfidence('Real Madrid', 'Atletico Madrid');
    expect(madridConf).toBe(0);

    // Same canonical team with aliased representation must match with high confidence
    const galaConf = TeamIdentityService.matchConfidence('Galatasaray', 'Galatasaray SK');
    expect(galaConf).toBeGreaterThanOrEqual(0.90);
  });

  it('2. ODDS ANALYSIS GATE: should block analysis on invalid or stale odds', () => {
    const testMatch: CanonicalMatch = {
      id: 'm_gate_test',
      externalId: 'gate_1',
      provider: 'Nesine',
      utcDate: new Date(Date.now() + 7200000).toISOString(),
      status: 'SCHEDULED',
      homeTeam: { id: 'tr_galatasaray', name: 'Galatasaray', shortName: 'GS', crest: 'https://crests.football-data.org/610.png' },
      awayTeam: { id: 'tr_fenerbahce', name: 'Fenerbahçe', shortName: 'FB', crest: 'https://crests.football-data.org/600.png' },
      league: { id: 'tr_superlig', name: 'Süper Lig', code: 'TR1' },
      odds: { homeWin: 1.00, draw: 3.50, awayWin: 4.20, bookmaker: 'Nesine', retrievedAt: new Date().toISOString() }, // Invalid homeWin <= 1.01
    };

    const report = canonicalEntityManager.runFinalConsistencyCheck(testMatch);
    expect(report.analysisPermitted).toBe(false);
    expect(report.blockingReasons.some((r) => r.includes('INVALID_ODDS_GUARD'))).toBe(true);
  });

  it('3. RESCHEDULED FIXTURE: should preserve lineage when match is postponed within the same season', () => {
    canonicalEntityManager.resetFixturesForTesting();
    const originalDate = '2026-09-15T19:00:00Z';
    const rescheduledDate = '2026-10-20T19:00:00Z';

    const reg1 = canonicalEntityManager.registerOrResolveFixture({
      provider: 'TestProvider',
      sourceFixtureId: 'fx_101',
      homeTeamName: 'Galatasaray',
      awayTeamName: 'Fenerbahçe',
      kickoffDate: originalDate,
      competitionCode: 'TR1',
    });

    expect(reg1.isNew).toBe(true);
    expect(reg1.fixture.isRescheduled).toBe(false);

    // Same competition and same teams rescheduled to next month in the same season
    const reg2 = canonicalEntityManager.registerOrResolveFixture({
      provider: 'TestProvider',
      sourceFixtureId: 'fx_101',
      homeTeamName: 'Galatasaray',
      awayTeamName: 'Fenerbahçe',
      kickoffDate: rescheduledDate,
      competitionCode: 'TR1',
    });

    expect(reg2.isNew).toBe(false);
    expect(reg2.fixture.isRescheduled).toBe(true);
    expect(reg2.fixture.canonicalFixtureId).toBe(reg1.fixture.canonicalFixtureId);
    expect(reg2.fixture.rescheduledFrom).toBe(originalDate);

    // Different season should NOT be merged
    const nextSeasonDate = '2027-09-15T19:00:00Z';
    const regNextSeason = canonicalEntityManager.registerOrResolveFixture({
      provider: 'TestProvider',
      sourceFixtureId: 'fx_202',
      homeTeamName: 'Galatasaray',
      awayTeamName: 'Fenerbahçe',
      kickoffDate: nextSeasonDate,
      competitionCode: 'TR1',
    });

    expect(regNextSeason.isNew).toBe(true);
    expect(regNextSeason.fixture.canonicalFixtureId).not.toBe(reg1.fixture.canonicalFixtureId);
  });

  it('4. PROVIDER FIXTURE ID INDEX: should map provider fixture IDs and prevent duplicate fixtures', () => {
    const regProviderA = canonicalEntityManager.registerOrResolveFixture({
      provider: 'ApiFootball',
      sourceFixtureId: 'af_8899',
      homeTeamName: 'Arsenal',
      awayTeamName: 'Chelsea',
      kickoffDate: '2026-11-01T15:00:00Z',
      competitionCode: 'PL',
    });

    // Lookup by source
    const found = canonicalEntityManager.getCanonicalFixtureBySource('ApiFootball', 'af_8899');
    expect(found).toBeDefined();
    expect(found?.canonicalFixtureId).toBe(regProviderA.fixture.canonicalFixtureId);

    // Re-registration by same provider with same ID returns existing without duplicate
    const reReg = canonicalEntityManager.registerOrResolveFixture({
      provider: 'ApiFootball',
      sourceFixtureId: 'af_8899',
      homeTeamName: 'Arsenal FC',
      awayTeamName: 'Chelsea FC',
      kickoffDate: '2026-11-01T15:00:00Z',
      competitionCode: 'PL',
    });
    expect(reReg.isNew).toBe(false);
    expect(reReg.fixture.canonicalFixtureId).toBe(regProviderA.fixture.canonicalFixtureId);

    // Another provider for same match binds to same canonical fixture
    const regProviderB = canonicalEntityManager.registerOrResolveFixture({
      provider: 'Nesine',
      sourceFixtureId: 'nes_7766',
      homeTeamName: 'Arsenal',
      awayTeamName: 'Chelsea',
      kickoffDate: '2026-11-01T15:00:00Z',
      competitionCode: 'PL',
    });
    expect(regProviderB.fixture.canonicalFixtureId).toBe(regProviderA.fixture.canonicalFixtureId);
    expect(regProviderB.fixture.sourceFixtureIds.some((s) => s.provider === 'Nesine')).toBe(true);
  });
});
