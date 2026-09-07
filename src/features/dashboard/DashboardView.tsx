// src/features/dashboard/DashboardView.tsx - Daily Scan & Ensemble Highlights
import React, { useState } from 'react';
import {
  Radar,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { CanonicalMatch, MatchAnalysis, MarketSignal } from '@/types';

interface DashboardViewProps {
  matches: CanonicalMatch[];
  analyses: Record<string, MatchAnalysis>;
  isScanning: boolean;
  onScanDay: () => void;
  onSelectMatch: (match: CanonicalMatch) => void;
  onRecordLedger?: (analysis: MatchAnalysis, signal: MarketSignal) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  matches,
  analyses,
  isScanning,
  onScanDay,
  onSelectMatch,
  onRecordLedger,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'QUALIFIED' | 'WATCH' | 'ABSTAIN'>('QUALIFIED');
  const [recordedMap, setRecordedMap] = useState<Record<string, boolean>>({});

  const analysesList = Object.values(analyses) as MatchAnalysis[];

  // Group signals
  const allAnalyzedSignals: Array<{ match: CanonicalMatch; analysis: MatchAnalysis; signal: MarketSignal }> = [];

  analysesList.forEach((analysis) => {
    if (analysis.primarySignal) {
      allAnalyzedSignals.push({
        match: analysis.match,
        analysis,
        signal: analysis.primarySignal,
      });
    } else {
      // Create fallback abstain signal representation
      const topCand = analysis.signals[0];
      if (topCand) {
        allAnalyzedSignals.push({
          match: analysis.match,
          analysis,
          signal: topCand,
        });
      }
    }
  });

  // Filter signals based on tab
  const qualifiedSignals = allAnalyzedSignals.filter(
    (item) => item.signal.passedRiskFilter && (item.signal.signalState === 'VERY_STRONG' || item.signal.signalState === 'STRONG' || item.signal.signalState === 'MEDIUM')
  );

  const watchSignals = allAnalyzedSignals.filter((item) => item.signal.signalState === 'WATCH');
  const abstainSignals = allAnalyzedSignals.filter((item) => !item.signal.passedRiskFilter || item.signal.signalState === 'ABSTAIN' || item.signal.signalState === 'MODELS_DISAGREE');

  const displayedList =
    filterMode === 'QUALIFIED'
      ? qualifiedSignals
      : filterMode === 'WATCH'
      ? watchSignals
      : filterMode === 'ABSTAIN'
      ? abstainSignals
      : allAnalyzedSignals;

  const handleRecordToLedger = (analysis: MatchAnalysis, signal: MarketSignal) => {
    const key = `${analysis.match.id}_${signal.market}`;
    if (recordedMap[key]) return;

    if (onRecordLedger) {
      onRecordLedger(analysis, signal);
      setRecordedMap((prev) => ({ ...prev, [key]: true }));
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner & Quick Scan */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 text-[11px] font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sert Risk Filtresi & Kalibrasyon Aktif</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Günlük Bülten & Sinyal Taraması</h2>
            <p className="text-xs text-slate-400 max-w-xl mt-1 leading-relaxed">
              Poisson, Dixon-Coles, Elo, Form ve Lig modelleri ensemble olarak harmanlanır. Çelişkili veya yetersiz veriler otomatik elenir (Abstention).
            </p>
          </div>

          <button
            id="btn-scan-day"
            onClick={onScanDay}
            disabled={isScanning || matches.length === 0}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-sm shadow-md transition-all active:scale-95 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Modeller Hesaplanıyor...' : 'GÜNÜ TARA'}</span>
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-medium">Bültendeki Maç</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{matches.length}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-medium">Analiz Edilen</span>
            <div className="text-xl font-extrabold text-sky-400 mt-0.5">{analysesList.length}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-emerald-400 font-medium">Filtreyi Geçen Sinyal</span>
            <div className="text-xl font-extrabold text-emerald-400 mt-0.5">{qualifiedSignals.length}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-amber-400 font-medium">Çekimser (Abstain)</span>
            <div className="text-xl font-extrabold text-amber-400 mt-0.5">{abstainSignals.length}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          id="tab-filter-qualified"
          onClick={() => setFilterMode('QUALIFIED')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            filterMode === 'QUALIFIED'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          Güçlü Sinyaller ({qualifiedSignals.length})
        </button>
        <button
          id="tab-filter-watch"
          onClick={() => setFilterMode('WATCH')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            filterMode === 'WATCH'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          İzleme Listesi ({watchSignals.length})
        </button>
        <button
          id="tab-filter-abstain"
          onClick={() => setFilterMode('ABSTAIN')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            filterMode === 'ABSTAIN'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          Riskli & Çekimser ({abstainSignals.length})
        </button>
        <button
          id="tab-filter-all"
          onClick={() => setFilterMode('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            filterMode === 'ALL'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          Tüm Analizler ({allAnalyzedSignals.length})
        </button>
      </div>

      {/* Signals List */}
      {displayedList.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Info className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            {filterMode === 'QUALIFIED' ? 'BUGÜN GÜÇLÜ SİNYAL BULUNAMADI' : 'Kayıt Bulunmuyor'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            {filterMode === 'QUALIFIED'
              ? 'İncelenen maçlar veri kalitesi (asgari 55/100), model uzlaşısı veya olasılık eşiklerini karşılamadığı için sistem risk almayarak çekimser (ABSTAIN) kalmıştır.'
              : 'Henüz bu kategoride gösterilecek analiz edilmiş maç bulunmuyor. "GÜNÜ TARA" butonuna basarak analizleri başlatabilirsiniz.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.map(({ match, analysis, signal }) => {
            const isRecorded = recordedMap[`${match.id}_${signal.market}`];

            return (
              <div
                key={`${match.id}_${signal.market}`}
                className={`bg-slate-900 border rounded-2xl p-4.5 transition-all hover:border-slate-700 shadow-sm flex flex-col justify-between ${
                  signal.passedRiskFilter
                    ? 'border-slate-800 hover:border-emerald-700/60'
                    : 'border-slate-800/80 opacity-90'
                }`}
              >
                <div>
                  {/* Card Header: League & Match Time */}
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span className="font-semibold text-slate-300 truncate max-w-[200px]">
                      {match.league.name}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(match.utcDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      {match.homeTeam.crest ? (
                        <img src={match.homeTeam.crest} alt="" className="w-5 h-5 object-contain shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">H</div>
                      )}
                      <span className="font-bold text-sm text-white truncate">{match.homeTeam.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500 shrink-0">vs</span>
                    <div className="flex items-center gap-2 min-w-0 justify-end">
                      <span className="font-bold text-sm text-white truncate text-right">{match.awayTeam.name}</span>
                      {match.awayTeam.crest ? (
                        <img src={match.awayTeam.crest} alt="" className="w-5 h-5 object-contain shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">A</div>
                      )}
                    </div>
                  </div>

                  {/* Signal Box */}
                  <div className={`p-3 rounded-xl mb-3 border ${
                    signal.signalState === 'VERY_STRONG'
                      ? 'bg-emerald-950/40 border-emerald-700/50'
                      : signal.signalState === 'STRONG'
                      ? 'bg-emerald-950/30 border-emerald-800/40'
                      : signal.signalState === 'MEDIUM'
                      ? 'bg-sky-950/30 border-sky-800/40'
                      : signal.signalState === 'WATCH'
                      ? 'bg-amber-950/30 border-amber-800/40'
                      : 'bg-rose-950/30 border-rose-800/40'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-slate-900/80 text-slate-200">
                          {signal.market}
                        </span>
                        <span className="text-xs font-bold text-white">{signal.selection}</span>
                      </div>

                      {/* State Badge */}
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        signal.signalState === 'VERY_STRONG'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : signal.signalState === 'STRONG'
                          ? 'bg-emerald-900 text-emerald-200 border-emerald-700'
                          : signal.signalState === 'MEDIUM'
                          ? 'bg-sky-900 text-sky-200 border-sky-700'
                          : signal.signalState === 'WATCH'
                          ? 'bg-amber-900 text-amber-200 border-amber-700'
                          : 'bg-rose-900 text-rose-200 border-rose-700'
                      }`}>
                        {signal.signalState === 'VERY_STRONG'
                          ? 'ÇOK GÜÇLÜ'
                          : signal.signalState === 'STRONG'
                          ? 'GÜÇLÜ'
                          : signal.signalState === 'MEDIUM'
                          ? 'ORTA'
                          : signal.signalState === 'WATCH'
                          ? 'İZLEME'
                          : 'ÇEKİMSER (ABSTAIN)'}
                      </span>
                    </div>

                    {/* Stats Bar */}
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Model Olasılığı</span>
                        <span className="text-xs font-extrabold text-emerald-400">
                          %{(signal.modelProbability * 100).toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Güven Endeksi</span>
                        <span className="text-xs font-extrabold text-white">
                          {signal.confidence}/100
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Veri Kalitesi</span>
                        <span className="text-xs font-extrabold text-slate-300">
                          {signal.dataQuality}/100
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reasons / Warnings */}
                  <div className="space-y-1 mb-3">
                    {signal.reasons.slice(0, 2).map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{r}</span>
                      </div>
                    ))}
                    {signal.warnings.slice(0, 1).map((w, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400/90">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{w}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                  {signal.passedRiskFilter && (
                    <button
                      id={`btn-record-ledger-${match.id}`}
                      onClick={() => handleRecordToLedger(analysis, signal)}
                      disabled={isRecorded}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                        isRecorded
                          ? 'bg-slate-800 text-slate-500 cursor-default'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95'
                      }`}
                    >
                      {isRecorded ? 'Ledger\'a Kaydedildi' : 'Ledger\'a Ekle'}
                    </button>
                  )}

                  <button
                    id={`btn-open-analysis-${match.id}`}
                    onClick={() => onSelectMatch(match)}
                    className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>Derin Analiz</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
