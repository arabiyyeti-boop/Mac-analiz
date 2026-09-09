// src/services/api.ts - Client API Service & Real Data Bridge
import { CanonicalMatch, MatchAnalysis, AIExplanation, MarketSignal, NesineMatchOddsData, NesineAvailability } from '@/types';
import { MatchAnalysisEngine } from '@/analysis/engine';
import { AIExplanationService } from '@/ai/gemini';
import { NesineOddsProvider } from '@/api/providers/NesineOddsProvider';
import { predictionLedger } from '@/prediction/ledger';
import { defaultStorage } from '@/storage/LocalStorageProvider';

const FAVORITES_STORAGE_KEY = 'macanaliz_favorites_v1';

export class AppApiService {
  /**
   * Fetches real fixtures for selected date from server. Strictly no fake/mock data in production.
   */
  static async getFixtures(date?: string): Promise<{ matches: CanonicalMatch[]; isFallback: boolean; error?: string }> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/fixtures/today?date=${targetDate}`);

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return { matches: json.data, isFallback: false };
        }
      } else {
        const json = await res.json().catch(() => ({}));
        return { matches: [], isFallback: false, error: json.error?.message || 'PROVIDER_UNAVAILABLE' };
      }
    } catch {
      return { matches: [], isFallback: false, error: 'Ağ bağlantısı sağlanamadı veya canlı bültene erişilemiyor.' };
    }

    return { matches: [], isFallback: false };
  }

  /**
   * Runs or fetches match analysis
   */
  static async analyzeMatch(match: CanonicalMatch): Promise<MatchAnalysis> {
    try {
      const res = await fetch(`/api/match/${match.id}/analysis`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Server unreachable, use client-side pipeline with real match object
    }

    // Client-side computation with strict real match data
    return MatchAnalysisEngine.run({
      match,
    });
  }

  /**
   * Requests contextual AI explanation from server or uses client-side fallback
   */
  static async getAIExplanation(analysis: MatchAnalysis): Promise<AIExplanation> {
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Network failure
    }

    return AIExplanationService.generateFallbackExplanation(analysis);
  }

  /**
   * Fetches real Nesine market odds, overrounds, movements & probability edge
   */
  static async getNesineOdds(
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    modelProbs?: { home?: number; draw?: number; away?: number; over25?: number; btts?: number }
  ): Promise<NesineMatchOddsData> {
    try {
      const params = new URLSearchParams({
        matchId,
        home: homeTeam,
        away: awayTeam,
      });
      const res = await fetch(`/api/nesine/odds?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Server unreachable, use direct client provider
    }

    // Direct fallback through client Nesine provider
    const nesine = NesineOddsProvider.getInstance();
    return nesine.getOddsForMatch(matchId, homeTeam, awayTeam, modelProbs);
  }

  /**
   * Gets Nesine provider diagnostic status
   */
  static async getNesineStatus(): Promise<{ status: NesineAvailability; lastFetch: string | null; error: string | null; totalEvents: number }> {
    try {
      const res = await fetch('/api/nesine/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Server unreachable
    }

    const nesine = NesineOddsProvider.getInstance();
    return nesine.getStatus();
  }

  /**
   * Favorites management
   */
  static async getFavorites(): Promise<string[]> {
    const list = await defaultStorage.get<string[]>(FAVORITES_STORAGE_KEY);
    return list || [];
  }

  static async toggleFavorite(matchId: string): Promise<string[]> {
    const current = await this.getFavorites();
    let updated: string[];
    if (current.includes(matchId)) {
      updated = current.filter((id) => id !== matchId);
    } else {
      updated = [...current, matchId];
    }
    await defaultStorage.set(FAVORITES_STORAGE_KEY, updated);
    return updated;
  }

  /**
   * Clear all app state (favorites, ledger, local caches)
   */
  static async clearAllData(): Promise<void> {
    await defaultStorage.clear();
    await predictionLedger.clearLedger();
  }
}
