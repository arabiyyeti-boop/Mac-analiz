// src/App.tsx - MAÇ ANALİZ PRO Application Root
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/common/Header';
import { BottomNavigation, NavTab } from '@/components/layout/BottomNavigation';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { MatchesView } from '@/features/matches/MatchesView';
import { DeepAnalysisView } from '@/features/analysis/DeepAnalysisView';
import { FavoritesView } from '@/features/favorites/FavoritesView';
import { HistoryLedgerView } from '@/features/history/HistoryLedgerView';
import { SettingsView } from '@/features/settings/SettingsView';
import { CanonicalMatch, MatchAnalysis, AIExplanation, MarketSignal } from '@/types';
import { AppApiService } from '@/services/api';
import { predictionLedger } from '@/prediction/ledger';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [matches, setMatches] = useState<CanonicalMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<CanonicalMatch | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, MatchAnalysis>>({});
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  const [aiExplanations, setAiExplanations] = useState<Record<string, AIExplanation>>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

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

  // Load favorites
  useEffect(() => {
    AppApiService.getFavorites().then(setFavorites);
  }, []);

  // Fetch matches whenever date changes
  const loadMatches = useCallback(async (date: string) => {
    setIsLoadingMatches(true);
    try {
      const { matches: list } = await AppApiService.getFixtures(date);
      setMatches(list);

      // Pre-analyze the first 2 matches if available for quick experience
      if (list.length > 0) {
        const topMatches = list.slice(0, 3);
        for (const m of topMatches) {
          AppApiService.analyzeMatch(m).then((analysis) => {
            setAnalyses((prev) => ({ ...prev, [m.id]: analysis }));
          });
        }
      }
    } finally {
      setIsLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    loadMatches(selectedDate);
  }, [selectedDate, loadMatches]);

  // Deep analyze selected match
  const handleSelectMatch = async (match: CanonicalMatch) => {
    setSelectedMatch(match);
    setActiveTab('analysis');

    if (!analyses[match.id]) {
      setIsLoadingAnalysis(true);
      try {
        const analysis = await AppApiService.analyzeMatch(match);
        setAnalyses((prev) => ({ ...prev, [match.id]: analysis }));
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
      const analysis = await AppApiService.analyzeMatch(selectedMatch);
      setAnalyses((prev) => ({ ...prev, [selectedMatch.id]: analysis }));
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Scan entire day's bulletin
  const handleScanDay = async () => {
    if (matches.length === 0 || isScanning) return;
    setIsScanning(true);

    try {
      for (const m of matches) {
        if (!analyses[m.id]) {
          const analysis = await AppApiService.analyzeMatch(m);
          setAnalyses((prev) => ({ ...prev, [m.id]: analysis }));
        }
      }
    } finally {
      setIsScanning(false);
    }
  };

  // AI explanation request
  const handleRequestAIExplanation = async () => {
    if (!selectedMatch) return;
    const currentAnalysis = analyses[selectedMatch.id];
    if (!currentAnalysis) return;

    setIsLoadingAI(true);
    try {
      const explanation = await AppApiService.getAIExplanation(currentAnalysis);
      setAiExplanations((prev) => ({ ...prev, [selectedMatch.id]: explanation }));
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
  const handleRecordLedger = async (analysis: MatchAnalysis, signal: MarketSignal) => {
    await predictionLedger.recordPrediction(analysis, signal);
  };

  // Clear all data
  const handleClearAllData = async () => {
    await AppApiService.clearAllData();
    setFavorites([]);
    setAnalyses({});
    setAiExplanations({});
    await loadMatches(selectedDate);
  };

  // Get active tab title
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Genel Bakış';
      case 'matches':
        return 'Bülten';
      case 'analysis':
        return 'Derin Analiz';
      case 'favorites':
        return 'Favoriler';
      case 'ledger':
        return 'Prediction Ledger';
      case 'settings':
        return 'Ayarlar';
    }
  };

  const currentAnalysis = selectedMatch ? analyses[selectedMatch.id] || null : null;
  const currentAIExplanation = selectedMatch ? aiExplanations[selectedMatch.id] || null : null;

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      <Header isOnline={isOnline} activeTabTitle={getTabTitle()} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-5">
        {activeTab === 'dashboard' && (
          <DashboardView
            matches={matches}
            analyses={analyses}
            isScanning={isScanning}
            onScanDay={handleScanDay}
            onSelectMatch={handleSelectMatch}
            onRecordLedger={handleRecordLedger}
          />
        )}

        {activeTab === 'matches' && (
          <MatchesView
            matches={matches}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onSelectMatch={handleSelectMatch}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            isLoading={isLoadingMatches}
          />
        )}

        {activeTab === 'analysis' && (
          <DeepAnalysisView
            analysis={currentAnalysis}
            isLoading={isLoadingAnalysis}
            onRefreshAnalysis={handleRefreshAnalysis}
            onRecordLedger={handleRecordLedger}
            aiExplanation={currentAIExplanation}
            isLoadingAI={isLoadingAI}
            onRequestAIExplanation={handleRequestAIExplanation}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView
            favorites={favorites}
            allMatches={matches}
            onSelectMatch={handleSelectMatch}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activeTab === 'ledger' && <HistoryLedgerView />}

        {activeTab === 'settings' && (
          <SettingsView onClearAllData={handleClearAllData} />
        )}
      </main>

      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favoritesCount={favorites.length}
        hasSelectedMatch={Boolean(selectedMatch)}
      />
    </div>
  );
}
