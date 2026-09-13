// src/App.tsx - MAÇ ANALİZ PRO Application Root
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/common/Header';
import { BottomNavigation, NavTab } from '@/components/layout/BottomNavigation';
import { MainHomeView } from '@/features/home/MainHomeView';
import { MatchDetailView } from '@/features/matches/MatchDetailView';
import { SettingsView } from '@/features/settings/SettingsView';
import { CanonicalMatch, MatchAnalysis, AIExplanation, MarketSignal, ProviderHealth } from '@/types';
import { AppApiService } from '@/services/api';
import { predictionLedger } from '@/prediction/ledger';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('matches');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [matches, setMatches] = useState<CanonicalMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);

  const [selectedMatch, setSelectedMatch] = useState<CanonicalMatch | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, MatchAnalysis>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  const [aiExplanations, setAiExplanations] = useState<Record<string, AIExplanation>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const [favorites, setFavorites] = useState<string[]>([]);

  // Online / Offline tracking
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load favorites and provider health on initial mount
  useEffect(() => {
    AppApiService.getFavorites().then(setFavorites);
    AppApiService.getProviderStatus().then(setProviderHealth);
  }, []);

  // Fetch matches whenever date changes
  const loadMatches = useCallback(async (date: string) => {
    setIsLoadingMatches(true);
    setFetchError(null);
    try {
      const { matches: list, error } = await AppApiService.getFixtures(date);
      setMatches(list);
      if (error) {
        setFetchError(error);
      } else {
        setFetchError(null);
      }

      // Refresh provider diagnostic status
      AppApiService.getProviderStatus().then(setProviderHealth);

      // Pre-analyze the first 2 matches if available for quick experience
      if (list.length > 0) {
        const topMatches = list.slice(0, 2);
        for (const m of topMatches) {
          AppApiService.analyzeMatch(m).then(({ analysis, error: aErr }) => {
            setAnalyses((prev) => ({ ...prev, [m.id]: analysis }));
            if (aErr) {
              setAnalysisErrors((prev) => ({ ...prev, [m.id]: aErr }));
            }
          });
        }
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Karşılaşmalar yüklenirken beklenmeyen bir hata oluştu.');
      AppApiService.getProviderStatus().then(setProviderHealth);
    } finally {
      setIsLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    loadMatches(selectedDate);
  }, [selectedDate, loadMatches]);

  // Select match & analyze
  const handleSelectMatch = async (match: CanonicalMatch) => {
    setSelectedMatch(match);

    if (!analyses[match.id]) {
      setIsLoadingAnalysis(true);
      try {
        const { analysis, error: aErr } = await AppApiService.analyzeMatch(match);
        setAnalyses((prev) => ({ ...prev, [match.id]: analysis }));
        if (aErr) {
          setAnalysisErrors((prev) => ({ ...prev, [match.id]: aErr }));
        }
      } finally {
        setIsLoadingAnalysis(false);
      }
    }
  };

  // Re-run analysis for current match
  const handleRefreshAnalysis = async () => {
    if (!selectedMatch) return;
    setIsLoadingAnalysis(true);
    try {
      const { analysis, error: aErr } = await AppApiService.analyzeMatch(selectedMatch);
      setAnalyses((prev) => ({ ...prev, [selectedMatch.id]: analysis }));
      if (aErr) {
        setAnalysisErrors((prev) => ({ ...prev, [selectedMatch.id]: aErr }));
      } else {
        setAnalysisErrors((prev) => {
          const next = { ...prev };
          delete next[selectedMatch.id];
          return next;
        });
      }
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // AI explanation request
  const handleRequestAIExplanation = async () => {
    if (!selectedMatch) return;
    const currentAnalysis = analyses[selectedMatch.id];
    if (!currentAnalysis) return;

    setIsLoadingAI(true);
    try {
      const { explanation, error: aiErr } = await AppApiService.getAIExplanation(currentAnalysis);
      setAiExplanations((prev) => ({ ...prev, [selectedMatch.id]: explanation }));
      if (aiErr) {
        setAiErrors((prev) => ({ ...prev, [selectedMatch.id]: aiErr }));
      } else {
        setAiErrors((prev) => {
          const next = { ...prev };
          delete next[selectedMatch.id];
          return next;
        });
      }
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (matchId: string) => {
    const updated = await AppApiService.toggleFavorite(matchId);
    setFavorites(updated);
  };

  // Record prediction to ledger
  const handleRecordLedger = async (
    analysis: MatchAnalysis,
    signal: MarketSignal,
    oddsData?: {
      snapshotId?: string;
      opening?: number;
      current?: number;
      source?: string;
      overround?: number;
      probabilityEdge?: number;
      squadSnapshotId?: string;
      marketRegime?: string;
      closingOdds?: number;
      clvPercent?: number;
      recordVersion?: string;
    }
  ) => {
    await predictionLedger.recordPrediction(analysis, signal, oddsData);
  };

  // Clear all data
  const handleClearAllData = async () => {
    await AppApiService.clearAllData();
    setFavorites([]);
    setAnalyses({});
    setAnalysisErrors({});
    setAiExplanations({});
    setAiErrors({});
    await loadMatches(selectedDate);
  };

  // Get active tab title
  const getTabTitle = () => {
    if (selectedMatch) {
      return `${selectedMatch.homeTeam.name} vs ${selectedMatch.awayTeam.name}`;
    }
    switch (activeTab) {
      case 'matches':
        return 'Maçlar';
      case 'favorites':
        return 'Favoriler';
      case 'leagues':
        return 'Ligler';
      case 'search':
        return 'Maç Ara';
      case 'settings':
        return 'Ayarlar';
      default:
        return 'Maçlar';
    }
  };

  const currentAnalysis = selectedMatch ? analyses[selectedMatch.id] || null : null;
  const currentAIExplanation = selectedMatch ? aiExplanations[selectedMatch.id] || null : null;
  const currentAnalysisError = selectedMatch ? analysisErrors[selectedMatch.id] : undefined;
  const currentAIError = selectedMatch ? aiErrors[selectedMatch.id] : undefined;

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      <Header
        isOnline={isOnline}
        activeTabTitle={getTabTitle()}
        onOpenSettings={() => {
          setSelectedMatch(null);
          setActiveTab('settings');
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-4">
        {selectedMatch ? (
          <MatchDetailView
            match={selectedMatch}
            analysis={currentAnalysis}
            isLoadingAnalysis={isLoadingAnalysis}
            onBack={() => setSelectedMatch(null)}
            onRefreshAnalysis={handleRefreshAnalysis}
            onRecordLedger={handleRecordLedger}
            aiExplanation={currentAIExplanation}
            isLoadingAI={isLoadingAI}
            onRequestAIExplanation={handleRequestAIExplanation}
            analysisError={currentAnalysisError}
            aiError={currentAIError}
          />
        ) : (
          <>
            {activeTab === 'matches' && (
              <MainHomeView
                matches={matches}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onSelectMatch={handleSelectMatch}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                isLoading={isLoadingMatches}
                fetchError={fetchError}
                providerHealth={providerHealth}
                onRetry={() => loadMatches(selectedDate)}
              />
            )}

            {activeTab === 'favorites' && (
              <MainHomeView
                matches={matches}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onSelectMatch={handleSelectMatch}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                isLoading={isLoadingMatches}
                initialCategory="FAVORITES"
                fetchError={fetchError}
                providerHealth={providerHealth}
                onRetry={() => loadMatches(selectedDate)}
              />
            )}

            {activeTab === 'leagues' && (
              <MainHomeView
                matches={matches}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onSelectMatch={handleSelectMatch}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                isLoading={isLoadingMatches}
                fetchError={fetchError}
                providerHealth={providerHealth}
                onRetry={() => loadMatches(selectedDate)}
              />
            )}

            {activeTab === 'search' && (
              <MainHomeView
                matches={matches}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onSelectMatch={handleSelectMatch}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                isLoading={isLoadingMatches}
                focusSearch={true}
                fetchError={fetchError}
                providerHealth={providerHealth}
                onRetry={() => loadMatches(selectedDate)}
              />
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4 pb-20">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h2 className="text-base font-bold text-white">Uygulama Ayarları</h2>
                  <button
                    onClick={() => setActiveTab('matches')}
                    className="text-xs text-emerald-400 font-semibold hover:underline"
                  >
                    Maçlara Dön &rarr;
                  </button>
                </div>
                <SettingsView onClearAllData={handleClearAllData} />
              </div>
            )}
          </>
        )}
      </main>

      <BottomNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setSelectedMatch(null);
          setActiveTab(tab);
        }}
        favoritesCount={favorites.length}
      />
    </div>
  );
}
