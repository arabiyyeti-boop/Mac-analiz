// src/services/api.ts - Client API Service & Offline Fallback Bridge
import { CanonicalMatch, MatchAnalysis, AIExplanation, MarketSignal } from '@/types';
import { SAMPLE_MATCHES, SAMPLE_MATCH_CONTEXT } from '@/data/sampleFixtures';
import { MatchAnalysisEngine } from '@/analysis/engine';
import { AIExplanationService } from '@/ai/gemini';
import { predictionLedger } from '@/prediction/ledger';
import { defaultStorage } from '@/storage/LocalStorageProvider';

const FAVORITES_STORAGE_KEY = 'macanaliz_favorites_v1';

export class AppApiService {
  /**
   * Fetches fixtures for selected date. Uses server route when available, falls back to canonical sample data.
   */
  static async getFixtures(date?: string): Promise<{ matches: CanonicalMatch[]; isFallback: boolean }> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/fixtures/today?date=${targetDate}`);

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          return { matches: json.data, isFallback: false };
        }
      }
    } catch {
      // Offline or network error
    }

    // Return sample matches
    return { matches: SAMPLE_MATCHES, isFallback: true };
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
      // Server unreachable, use client-side pipeline
    }

    // Client-side fallback computation
    const context = SAMPLE_MATCH_CONTEXT[match.id];
    return MatchAnalysisEngine.run({
      match,
      homeForm: context?.homeForm,
      awayForm: context?.awayForm,
      h2h: context?.h2h,
      standing: context?.standing,
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
