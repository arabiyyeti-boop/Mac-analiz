// src/features/matches/MatchDetailView.tsx - Match Detail View with 5 Clean Tabs
import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  BarChart3,
  Percent,
  History,
  Cpu,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  RefreshCw,
} from 'lucide-react';
import { CanonicalMatch, MatchAnalysis, MarketSignal, AIExplanation } from '@/types';
import { TeamLogo } from '@/components/TeamLogo';
import { NesineOddsPanel } from '@/features/analysis/NesineOddsPanel';
import { H2HStatusPanel } from '@/features/analysis/H2HStatusPanel';
import { DeepAnalysisView } from '@/features/analysis/DeepAnalysisView';

export type MatchDetailTab = 'GENEL' | 'ORANLAR' | 'ISTATISTIK' | 'H2H' | 'ANALIZ';

interface MatchDetailViewProps {
  match: CanonicalMatch;
  analysis: MatchAnalysis | null;
  isLoadingAnalysis: boolean;
  onBack: () => void;
  onRefreshAnalysis: () => void;
  onRecordLedger?: (
    analysis: MatchAnalysis,
    signal: MarketSignal,
    oddsData?: any
  ) => void;
  aiExplanation: AIExplanation | null;
  isLoadingAI: boolean;
  onRequestAIExplanation: () => void;
  analysisError?: string;
  aiError?: string;
}

export const MatchDetailView: React.FC<MatchDetailViewProps> = ({
  match,
  analysis,
  isLoadingAnalysis,
  onBack,
  onRefreshAnalysis,
  onRecordLedger,
  aiExplanation,
  isLoadingAI,
  onRequestAIExplanation,
  analysisError,
  aiError,
}) => {
  const [activeTab, setActiveTab] = useState<MatchDetailTab>('GENEL');

  const matchDate = new Date(match.utcDate).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const matchTime = new Date(match.utcDate).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED';

  // Probabilities from analysis (Ensemble or Poisson/Dixon-Coles)
  const pHome = analysis?.ensemble?.pHome ?? analysis?.models?.poisson?.pHome ?? 0.45;
  const pDraw = analysis?.ensemble?.pDraw ?? analysis?.models?.poisson?.pDraw ?? 0.28;
  const pAway = analysis?.ensemble?.pAway ?? analysis?.models?.poisson?.pAway ?? 0.27;

  // Quality badge
  const qualityScore = analysis?.dataQuality?.score ?? 0;
  const getQualityBadge = () => {
    if (qualityScore >= 75) {
      return {
        label: 'Veri Kalitesi: Yüksek',
        color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
      };
    }
    if (qualityScore >= 50) {
      return {
        label: 'Veri Kalitesi: Orta',
        color: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
      };
    }
    return {
      label: 'Veri Kalitesi: Kısıtlı',
      color: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
    };
  };
  const qualityBadge = getQualityBadge();

  return (
    <div className="space-y-4 pb-20">
      {/* Top Bar: Back button and League */}
      <div className="flex items-center justify-between gap-2">
        <button
          id="btn-back-to-matches"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400" />
          <span>Geri</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl truncate">
          <span>{match.league.name}</span>
          {match.league.country && (
            <span className="text-slate-500 font-normal">({match.league.country})</span>
          )}
        </div>

        <button
          id="btn-refresh-match-detail"
          onClick={onRefreshAnalysis}
          disabled={isLoadingAnalysis}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Analizi Yenile"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingAnalysis ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Analysis Error / Warning Banner */}
      {analysisError && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-300 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Analiz Sunucusu Bildirimi: </span>
            <span>{analysisError} (Yerel istatistiksel modeller üzerinden hesaplama yapıldı)</span>
          </div>
        </div>
      )}

      {/* Hero Match Board */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-4 pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {matchDate}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {matchTime}
            </span>
          </div>

          <div>
            {isLive ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/40 animate-pulse">
                CANLI {match.minute ? `${match.minute}'` : ''}
              </span>
            ) : isFinished ? (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-[10px]">
                MAÇ BİTTİ
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium text-[10px]">
                Başlamadı
              </span>
            )}
          </div>
        </div>

        {/* Teams and Score Display */}
        <div className="grid grid-cols-7 items-center gap-2 py-2">
          {/* Home Team */}
          <div className="col-span-3 flex flex-col items-center text-center gap-2">
            <TeamLogo
              teamName={match.homeTeam.name}
              crestUrl={match.homeTeam.crest}
              canonicalTeamId={String(match.homeTeam.id)}
              size="lg"
            />
            <span className="font-extrabold text-sm sm:text-base text-white line-clamp-2">
              {match.homeTeam.name}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
              Ev Sahibi
            </span>
          </div>

          {/* Score or VS */}
          <div className="col-span-1 flex flex-col items-center justify-center font-mono">
            {match.score?.fullTime?.home !== null && match.score?.fullTime?.home !== undefined ? (
              <div className="text-xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                {match.score.fullTime.home} - {match.score.fullTime.away}
              </div>
            ) : (
              <div className="text-sm sm:text-base font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-2.5 py-1 rounded-lg">
                VS
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="col-span-3 flex flex-col items-center text-center gap-2">
            <TeamLogo
              teamName={match.awayTeam.name}
              crestUrl={match.awayTeam.crest}
              canonicalTeamId={String(match.awayTeam.id)}
              size="lg"
            />
            <span className="font-extrabold text-sm sm:text-base text-white line-clamp-2">
              {match.awayTeam.name}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
              Deplasman
            </span>
          </div>
        </div>

        {match.venue && (
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800/60">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            <span>{match.venue}</span>
          </div>
        )}
      </div>

      {/* Tabs Navigation: [ GENEL ] [ ORANLAR ] [ İSTATİSTİK ] [ H2H ] [ ANALİZ ] */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none">
        {(
          [
            { id: 'GENEL', label: 'Genel' },
            { id: 'ORANLAR', label: 'Oranlar' },
            { id: 'ISTATISTIK', label: 'İstatistik' },
            { id: 'H2H', label: 'H2H' },
            { id: 'ANALIZ', label: 'Detaylı Analiz' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            id={`tab-match-${t.id.toLowerCase()}`}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap min-h-[44px] flex items-center justify-center ${
              activeTab === t.id
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: GENEL */}
      {activeTab === 'GENEL' && (
        <div className="space-y-4">
          {/* Tahmin Özeti Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Tahmin Özeti (Model Dağılımı)</h4>
                  <p className="text-[10px] text-slate-400">İstatistiksel model ve ensemble konsensüsü</p>
                </div>
              </div>

              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${qualityBadge.color}`}>
                {qualityBadge.label}
              </span>
            </div>

            {/* 1X2 Probabilities Bar */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-semibold text-slate-400 block mb-1">Ev Sahibi (1)</span>
                <span className="font-mono text-base font-extrabold text-emerald-400">
                  %{(pHome * 100).toFixed(1)}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-semibold text-slate-400 block mb-1">Beraberlik (X)</span>
                <span className="font-mono text-base font-extrabold text-amber-400">
                  %{(pDraw * 100).toFixed(1)}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-semibold text-slate-400 block mb-1">Deplasman (2)</span>
                <span className="font-mono text-base font-extrabold text-sky-400">
                  %{(pAway * 100).toFixed(1)}
                </span>
              </div>
            </div>

            {/* Action button to switch to Deep Analysis */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Poisson, Dixon-Coles, Elo ve Monte Carlo modelleri
              </span>
              <button
                id="btn-goto-detailed-analysis"
                onClick={() => setActiveTab('ANALIZ')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all"
              >
                <span>Detaylı Analiz</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Form & Basic Performance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Home Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white truncate">{match.homeTeam.name}</span>
                <span className="text-[10px] font-semibold text-slate-400">Ev Formu</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold mt-2">
                {analysis?.models?.form?.homeLast5 && analysis.models.form.homeLast5.length > 0 ? (
                  analysis.models.form.homeLast5.map((res, i) => (
                    <span
                      key={i}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] ${
                        res === 'W'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : res === 'D'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {res === 'W' ? 'G' : res === 'D' ? 'B' : 'M'}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 font-normal">Form verisi hazırlanıyor</span>
                )}
              </div>
            </div>

            {/* Away Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white truncate">{match.awayTeam.name}</span>
                <span className="text-[10px] font-semibold text-slate-400">Deplasman Formu</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold mt-2">
                {analysis?.models?.form?.awayLast5 && analysis.models.form.awayLast5.length > 0 ? (
                  analysis.models.form.awayLast5.map((res, i) => (
                    <span
                      key={i}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] ${
                        res === 'W'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : res === 'D'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {res === 'W' ? 'G' : res === 'D' ? 'B' : 'M'}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 font-normal">Form verisi hazırlanıyor</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Summary */}
          {analysis?.models?.poisson && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-400 block">Beklenen Gol (Ev)</span>
                <span className="font-mono text-sm font-bold text-white">
                  {analysis.models.poisson.lambdaHome.toFixed(2)}
                </span>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-400 block">Beklenen Gol (Dep)</span>
                <span className="font-mono text-sm font-bold text-white">
                  {analysis.models.poisson.lambdaAway.toFixed(2)}
                </span>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-400 block">2.5 Üst Olasılığı</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  %{(analysis.models.poisson.pOver25 * 100).toFixed(1)}
                </span>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] font-semibold text-slate-400 block">KG Var Olasılığı</span>
                <span className="font-mono text-sm font-bold text-amber-400">
                  %{(analysis.models.poisson.pBttsYes * 100).toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ORANLAR */}
      {activeTab === 'ORANLAR' && (
        <div>
          {analysis ? (
            <NesineOddsPanel analysis={analysis} />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white">Oran Verisi Yükleniyor</h4>
              <p className="text-xs text-slate-400 mt-1">
                Nesine bülten oranları ve piyasa marjları sorgulanıyor...
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: İSTATİSTİK */}
      {activeTab === 'ISTATISTIK' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Takım ve Karşılaşma İstatistikleri</h4>
                <p className="text-[10px] text-slate-400">Doğrulanmış istatistiksel parametreler</p>
              </div>
            </div>

            {analysis?.models?.elo && (
              <div className="mb-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs font-bold text-slate-300 mb-2">Elo Derecelendirmeleri</div>
                <div className="grid grid-cols-3 items-center text-center gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">{match.homeTeam.name}</span>
                    <span className="font-mono text-sm font-bold text-white">
                      {Math.round(analysis.models.elo.eloHome)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Elo Farkı</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      {analysis.models.elo.diff > 0 ? `+${Math.round(analysis.models.elo.diff)}` : Math.round(analysis.models.elo.diff)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">{match.awayTeam.name}</span>
                    <span className="font-mono text-sm font-bold text-white">
                      {Math.round(analysis.models.elo.eloAway)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {analysis?.models?.poisson && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-300">Gol Piyasaları Dağılımı</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-400">1.5 Üst:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      %{(analysis.models.poisson.pOver15 * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-400">1.5 Alt:</span>
                    <span className="font-mono font-bold text-slate-300">
                      %{(analysis.models.poisson.pUnder15 * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-400">2.5 Üst:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      %{(analysis.models.poisson.pOver25 * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-400">2.5 Alt:</span>
                    <span className="font-mono font-bold text-slate-300">
                      %{(analysis.models.poisson.pUnder25 * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-400">KG Var:</span>
                    <span className="font-mono font-bold text-amber-400">
                      %{(analysis.models.poisson.pBttsYes * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-400">KG Yok:</span>
                    <span className="font-mono font-bold text-slate-300">
                      %{(analysis.models.poisson.pBttsNo * 100).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: H2H */}
      {activeTab === 'H2H' && (
        <div>
          <H2HStatusPanel h2h={analysis?.h2h} match={match} />
        </div>
      )}

      {/* TAB 5: DETAYLI ANALİZ (Tüm modeller, ensemble, Monte Carlo, ledger, AI) */}
      {activeTab === 'ANALIZ' && (
        <div>
          <DeepAnalysisView
            analysis={analysis}
            isLoading={isLoadingAnalysis}
            onRefreshAnalysis={onRefreshAnalysis}
            onRecordLedger={onRecordLedger}
            aiExplanation={aiExplanation}
            isLoadingAI={isLoadingAI}
            onRequestAIExplanation={onRequestAIExplanation}
            aiError={aiError}
          />
        </div>
      )}
    </div>
  );
};
