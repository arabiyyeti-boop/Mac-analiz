// tests/unit/mathematicalModels.test.ts - Mathematical Axiom & Model Sanity Tests
import { describe, it, expect } from 'vitest';
import { calculatePoisson, poissonPmf } from '../../src/analysis/poisson';
import { calculateDixonColes } from '../../src/analysis/dixonColes';
import { calculateElo } from '../../src/analysis/elo';
import { OddsMovementEngine } from '../../src/analysis/oddsMovement';

describe('Poisson Probability Distribution', () => {
  it('should satisfy probability axioms (sum of 1X2 equals 1.0)', () => {
    const res = calculatePoisson(1.65, 1.15);
    const sum1X2 = res.pHome + res.pDraw + res.pAway;
    expect(sum1X2).toBeCloseTo(1.0, 3);
    expect(res.pHome).toBeGreaterThan(0);
    expect(res.pDraw).toBeGreaterThan(0);
    expect(res.pAway).toBeGreaterThan(0);
  });

  it('should sum over/under complementary probabilities to 1.0', () => {
    const res = calculatePoisson(1.5, 1.2);
    expect(res.pOver25 + res.pUnder25).toBeCloseTo(1.0, 3);
    expect(res.pOver15 + res.pUnder15).toBeCloseTo(1.0, 3);
  });

  it('should compute valid Poisson PMF values', () => {
    const p0 = poissonPmf(0, 1.5);
    const p1 = poissonPmf(1, 1.5);
    const p2 = poissonPmf(2, 1.5);
    expect(p0).toBeGreaterThan(0);
    expect(p1).toBeGreaterThan(0);
    expect(p2).toBeGreaterThan(0);
    expect(p0 + p1 + p2).toBeLessThan(1.0);
  });
});

describe('Dixon-Coles Low-Score Dependence Model', () => {
  it('should produce normalized probabilities summing to 1.0', () => {
    const dc = calculateDixonColes(1.4, 1.1, -0.11);
    const sum = dc.pHome + dc.pDraw + dc.pAway;
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it('should adjust low-score probabilities compared to independent Poisson', () => {
    const lambdaH = 1.3;
    const lambdaA = 1.0;
    const p = calculatePoisson(lambdaH, lambdaA);
    const dc = calculateDixonColes(lambdaH, lambdaA, -0.11);

    // Negative rho suppresses 0-0 and 1-1 draws, boosting 1-0 and 0-1
    expect(Math.abs(p.pDraw - dc.pDraw)).toBeGreaterThan(0);
  });
});

describe('Elo Rating Engine with Home Advantage', () => {
  it('should grant home win advantage when teams have equal base Elo', () => {
    const equalElo = calculateElo(1500, 1500, 65);
    expect(equalElo.pHome).toBeGreaterThan(equalElo.pAway);
    expect(equalElo.pHome + equalElo.pDraw + equalElo.pAway).toBeCloseTo(1.0, 3);
  });

  it('should favor heavily superior away team', () => {
    const heavyAway = calculateElo(1300, 1800, 65);
    expect(heavyAway.pAway).toBeGreaterThan(heavyAway.pHome);
  });
});

describe('Market Overround & Fair Probability Normalization', () => {
  it('should correctly extract bookmaker overround margin and fair probabilities', () => {
    // Typical bookmaker odds: 2.10, 3.20, 3.40
    // Raw sum = 1/2.10 + 1/3.20 + 1/3.40 = 0.476 + 0.3125 + 0.294 = 1.0826 (8.26% overround)
    const res = OddsMovementEngine.calculateOverround([2.10, 3.20, 3.40]);
    expect(res.totalImplied).toBeGreaterThan(1.0);
    expect(res.overroundPercent).toBeGreaterThan(0);

    // Fair probabilities must sum to exactly 1.0
    const fairSum = res.fairProbabilities.reduce((a, b) => a + b, 0);
    expect(fairSum).toBeCloseTo(1.0, 4);
  });

  it('should detect value edge when model probability exceeds fair market probability', () => {
    // Bookmaker odd: 2.50 -> implied ~0.40. Fair ~0.38
    // If Model estimated 0.45, there is a positive edge
    const edge = OddsMovementEngine.calculateProbabilityEdge('MS', 'MS 1', 2.50, 0.38, 0.45);
    expect(edge.edgePercentage).toBeGreaterThan(0);
    expect(edge.hasValue).toBe(true);
    expect(edge.edge).toBeGreaterThan(0);
  });
});
