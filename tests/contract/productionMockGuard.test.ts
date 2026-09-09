// tests/contract/productionMockGuard.test.ts - Production Mock Guard & Integrity Contract Tests (Section 150)
import { describe, it, expect } from 'vitest';
import { canonicalEntityManager } from '../../src/entity/CanonicalEntityManager';
import { CanonicalMatch } from '../../src/types';

describe('Production Mock Guard & Zero-Trust Integrity', () => {
  it('should block analysis when home and away teams are unresolved', () => {
    const corruptedMatch: CanonicalMatch = {
      id: 'inv_1',
      externalId: 'inv_1',
      provider: 'CorruptedSource',
      utcDate: '2026-09-10T18:00:00Z',
      status: 'SCHEDULED',
      homeTeam: { id: '', name: '', shortName: '' },
      awayTeam: { id: '', name: '', shortName: '' },
      league: { id: 'l1', name: 'Unknown League', code: 'UNK' },
    };

    const report = canonicalEntityManager.runFinalConsistencyCheck(corruptedMatch);
    expect(report.analysisPermitted).toBe(false);
    expect(report.isConsistent).toBe(false);
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });

  it('should block analysis when kickoff date is invalid NaN', () => {
    const badDateMatch: CanonicalMatch = {
      id: 'inv_date',
      externalId: 'inv_date',
      provider: 'BadSource',
      utcDate: 'invalid-timestamp-string',
      status: 'SCHEDULED',
      homeTeam: { id: 'tr_galatasaray', name: 'Galatasaray', shortName: 'GS' },
      awayTeam: { id: 'tr_fenerbahce', name: 'Fenerbahçe', shortName: 'FB' },
      league: { id: 'tr_superlig', name: 'Süper Lig', code: 'TR1' },
    };

    const report = canonicalEntityManager.runFinalConsistencyCheck(badDateMatch);
    expect(report.analysisPermitted).toBe(false);
    expect(report.blockingReasons.some((r) => r.includes('Kritik Tarih Hatası'))).toBe(true);
  });

  it('should permit analysis when all canonical entities and links are verified', () => {
    const validMatch: CanonicalMatch = {
      id: 'nesine_20329',
      externalId: '20329',
      provider: 'Nesine',
      utcDate: new Date(Date.now() + 7200000).toISOString(),
      status: 'SCHEDULED',
      homeTeam: { id: 'tr_galatasaray', name: 'Galatasaray', shortName: 'GS', crest: 'https://crests.football-data.org/610.png' },
      awayTeam: { id: 'tr_fenerbahce', name: 'Fenerbahçe', shortName: 'FB', crest: 'https://crests.football-data.org/600.png' },
      league: { id: 'tr_superlig', name: 'Süper Lig', code: 'TR1' },
    };

    const report = canonicalEntityManager.runFinalConsistencyCheck(validMatch);
    expect(report.analysisPermitted).toBe(true);
    expect(report.isConsistent).toBe(true);
    expect(report.blockingReasons.length).toBe(0);
  });
});
