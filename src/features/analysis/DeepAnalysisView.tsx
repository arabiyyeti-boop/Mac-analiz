// src/features/analysis/DeepAnalysisView.tsx - Deep Statistical Analysis & Model Transparency
import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  Cpu,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { MatchAnalysis, MarketSignal, AIExplanation, ModelAgreement } from '@/types';

interface DeepAnalysisViewProps {
  analysis: MatchAnalysis | null;
  isLoading: boolean;
  onRefreshAnalysis: () => void;
  onRecordLedger?: (analysis: MatchAnalysis, signal: MarketSignal) => void;
  aiExplanation: AIExplanation | null;
  isLoadingAI: boolean;
  onRequestAIExplanation: () => void;
}

export const DeepAnalysisView: React.FC<DeepAnalysisViewProps> = ({
  analysis,
  isLoading,
  onRefreshAnalysis,
  onRecordLedger,
  aiExplanation,
  isLoadingAI,
  onRequestAIExplanation,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'MARKETS' | 'MODELS' | 'QUALITY' | 'AI'>('MARKETS');
  const [recordedMap, setRecordedMap] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-base font-bold text-white">İstatistiksel Modeller Çalıştırılıyor</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Poisson, Dixon-Coles, Elo ve Form algoritmaları çözümleniyor, sert risk filtresi kontrol ediliyor...
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center my-6">
        <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white">Analiz Seçilmedi</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Lütfen "Bülten" veya "Genel Bakış" sekmesinden derin analizini görüntülemek istediğiniz bir karşılaşmayı seçin.
        </p>
      </div>
    );
  }

  const { match, dataQuality, ensemble, models, agreement, signals, primarySignal, uncertainty, versions } = analysis;

  const handleRecord = (sig: MarketSignal) => {
    const key = `${match.id}_${sig.market}`;
    if (recordedMap[key]) return;
    if (onRecordLedger) {
      onRecordLedger(analysis, sig);
      setRecordedMap((prev) => ({ ...prev, [key]: true }));
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Match Banner */}
      <div className="bg-gradient-to-b from-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
          <span className="font-semibold text-slate-300">{match.league.name}</span>
          <span className="font-mono text-[11px] text-slate-400">
            {new Date(match.utcDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Teams Display */}
        <div className="grid grid-cols-5 items-center gap-3 py-2">
          <div className="col-span-2 flex items-center gap-2.5 min-w-0">
            {match.homeTeam.crest ? (
              <img src={match.homeTeam.crest} alt="" className="w-8 h-8 object-contain shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">H</div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-white truncate">{match.homeTeam.name}</h3>
              <span className="text-[10px] text-slate-400 font-medium">Ev Sahibi</span>
            </div>
          </div>

          <div className="col-span-1 text-center">
            {match.score?.fullTime?.home !== null && match.score?.fullTime?.home !== undefined ? (
              <div className="font-mono text-xl font-black text-emerald-400">
                {match.score.fullTime.home} - {match.score.fullTime.away}
              </div>
            ) : (
              <span className="text-sm font-bold text-slate-500 font-mono">VS</span>
            )}
          </div>

          <div className="col-span-2 flex items-center justify-end gap-2.5 min-w-0">
            <div className="min-w-0 text-right">
              <h3 className="text-base font-extrabold text-white truncate">{match.awayTeam.name}</h3>
              <span className="text-[10px] text-slate-400 font-medium">Deplasman</span>
            </div>
            {match.awayTeam.crest ? (
              <img src={match.awayTeam.crest} alt="" className="w-8 h-8 object-contain shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">A</div>
            )}
          </div>
        </div>

        {/* Primary Signal Ribbon */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Öne Çıkan Seçim:</span>
            {primarySignal ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {primarySignal.marketNameTr} ({primarySignal.selection})
                </span>
                <span className="text-xs font-extrabold text-white">
                  %{ (primarySignal.modelProbability * 100).toFixed(1) } Olasılık
                </span>
              </div>
            ) : (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Sinyal Üretilmedi (Çekimser / Abstain)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400">
              Veri Kalitesi: <strong className="text-slate-200">{dataQuality.score}/100</strong>
            </div>
            <button
              onClick={onRefreshAnalysis}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Analizi Yeniden Hesapla"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none">
        <button
          id="subtab-markets"
          onClick={() => setActiveSubTab('MARKETS')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'MARKETS'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Market Olasılıkları
        </button>
        <button
          id="subtab-models"
          onClick={() => setActiveSubTab('MODELS')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'MODELS'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Modeller & Uzlaşı
        </button>
        <button
          id="subtab-quality"
          onClick={() => setActiveSubTab('QUALITY')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'QUALITY'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Veri Kalitesi & Risk
        </button>
        <button
          id="subtab-ai"
          onClick={() => setActiveSubTab('AI')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
            activeSubTab === 'AI'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Yorumu</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: MARKETS PROBABILITIES & RISK FILTER */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'MARKETS' && (
        <div className="space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tüm Bahis Marketleri Analizi</h4>
              <span className="text-[11px] text-slate-400">Ensemble & Sert Risk Filtresi</span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {signals.map((sig) => {
                const isRec = recordedMap[`${match.id}_${sig.market}`];

                return (
                  <div key={sig.market} className="p-4 hover:bg-slate-850/40 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                          {sig.market}
                        </span>
                        <span className="text-sm font-bold text-white">{sig.marketNameTr}</span>
                        <span className="text-xs text-slate-400">({sig.selection})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          sig.signalState === 'VERY_STRONG'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : sig.signalState === 'STRONG'
                            ? 'bg-emerald-900/80 text-emerald-200 border-emerald-700'
                            : sig.signalState === 'MEDIUM'
                            ? 'bg-sky-900/80 text-sky-200 border-sky-700'
                            : sig.signalState === 'WATCH'
                            ? 'bg-amber-900/80 text-amber-200 border-amber-700'
                            : 'bg-rose-900/80 text-rose-200 border-rose-700'
                        }`}>
                          {sig.signalState}
                        </span>

                        {sig.passedRiskFilter && onRecordLedger && (
                          <button
                            onClick={() => handleRecord(sig)}
                            disabled={isRec}
                            className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all ${
                              isRec
                                ? 'bg-slate-800 text-slate-500 cursor-default'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                            }`}
                          >
                            {isRec ? 'Kayıtlı' : 'Ledger\'a Yaz'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Numerical Metrics Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/40 p-2.5 rounded-xl text-xs mt-2 border border-slate-800/40">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Model Olasılığı</span>
                        <span className="text-sm font-extrabold text-emerald-400 font-mono">
                          %{(sig.modelProbability * 100).toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Güven Endeksi</span>
                        <span className="text-sm font-extrabold text-white font-mono">
                          {sig.confidence} / 100
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Model Uzlaşısı</span>
                        <span className="text-sm font-extrabold text-sky-400 font-mono">
                          %{sig.agreementScore}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Sapma (Dispersion)</span>
                        <span className="text-sm font-extrabold text-slate-300 font-mono">
                          {sig.dispersion}
                        </span>
                      </div>
                    </div>

                    {/* Reasons or Risk Failures */}
                    <div className="mt-2 text-xs space-y-1">
                      {sig.passedRiskFilter ? (
                        sig.reasons.map((r, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))
                      ) : (
                        sig.riskFilterFailures.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[11px] text-rose-400">
                            <XCircle className="w-3 h-3 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: MATHEMATICAL MODELS & AGREEMENT */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'MODELS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Poisson */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Poisson Dağılımı</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">Bivariate PMF</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Beklenen gol oranları: Ev &lambda; = <strong>{models.poisson?.lambdaHome}</strong>, Deplasman &lambda; = <strong>{models.poisson?.lambdaAway}</strong>
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Ev (1)</span>
                  <span className="font-extrabold text-emerald-400 font-mono">%{((models.poisson?.pHome || 0) * 100).toFixed(1)}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Beraberlik (X)</span>
                  <span className="font-extrabold text-slate-200 font-mono">%{((models.poisson?.pDraw || 0) * 100).toFixed(1)}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Dep (2)</span>
                  <span className="font-extrabold text-sky-400 font-mono">%{((models.poisson?.pAway || 0) * 100).toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Dixon-Coles */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Dixon & Coles (1997)</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">&tau; Düzeltmesi</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Düşük skor korelasyonu (&rho; = {models.dixonColes?.appliedRho}) uygulanmış düzeltilmiş matris.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Ev (1)</span>
                  <span className="font-extrabold text-emerald-400 font-mono">%{((models.dixonColes?.pHome || 0) * 100).toFixed(1)}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Beraberlik (X)</span>
                  <span className="font-extrabold text-slate-200 font-mono">%{((models.dixonColes?.pDraw || 0) * 100).toFixed(1)}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Dep (2)</span>
                  <span className="font-extrabold text-sky-400 font-mono">%{((models.dixonColes?.pAway || 0) * 100).toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Elo Rating */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Elo Güç Derecelendirmesi</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">+90 Saha Avantajı</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Ev Elo: <strong>{models.elo?.homeElo}</strong> | Deplasman Elo: <strong>{models.elo?.awayElo}</strong> (&Delta; {models.elo?.eloDiff})
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Ev (1)</span>
                  <span className="font-extrabold text-emerald-400 font-mono">%{((models.elo?.pHome || 0) * 100).toFixed(1)}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Beraberlik (X)</span>
                  <span className="font-extrabold text-slate-200 font-mono">%{((models.elo?.pDraw || 0) * 100).toFixed(1)}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Dep (2)</span>
                  <span className="font-extrabold text-sky-400 font-mono">%{((models.elo?.pAway || 0) * 100).toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Form & Recency */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Rakip Düzeltmeli Form</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">Üstel Ağırlık</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Ev Form Skoru: <strong>{models.form?.homeFormScore}/100</strong> | Deplasman: <strong>{models.form?.awayFormScore}/100</strong>
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Ev (1)</span>
                  <span className="font-extrabold text-emerald-400 font-mono">%{((models.form?.pHome || 0) * 100).toFixed(1)}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Beraberlik (X)</span>
                  <span className="font-extrabold text-slate-200 font-mono">%{((models.form?.pDraw || 0) * 100).toFixed(1)}</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Dep (2)</span>
                  <span className="font-extrabold text-sky-400 font-mono">%{((models.form?.pAway || 0) * 100).toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Model Consensus & Agreement Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Model Uzlaşısı & Dağılım Tablosu (Consensus)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Market</th>
                    <th className="py-2 px-3">Ortalama (Mean)</th>
                    <th className="py-2 px-3">Ortanca (Median)</th>
                    <th className="py-2 px-3">Standart Sapma</th>
                    <th className="py-2 px-3">Aralık (Range)</th>
                    <th className="py-2 px-3">Uzlaşı Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {Object.entries(agreement).map(([mKey, rawAgr]) => {
                    const agr = rawAgr as ModelAgreement;
                    return (
                      <tr key={mKey}>
                        <td className="py-2 px-3 font-bold text-white font-sans">{mKey}</td>
                        <td className="py-2 px-3 text-emerald-400">%{(agr.mean * 100).toFixed(1)}</td>
                        <td className="py-2 px-3 text-slate-300">%{(agr.median * 100).toFixed(1)}</td>
                        <td className="py-2 px-3 text-slate-400">{agr.stdDev.toFixed(4)}</td>
                        <td className="py-2 px-3 text-slate-400">{agr.range.toFixed(4)}</td>
                        <td className="py-2 px-3 font-sans">
                          {agr.isAgreementHigh ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-bold">
                              YÜKSEK UZLAŞI
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800/60 font-bold">
                              GÖRÜŞ AYRILIĞI
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: DATA QUALITY & RISK AUDIT */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'QUALITY' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-white">Veri Kalitesi Skoru (Data Quality Index)</h4>
                <p className="text-xs text-slate-400 mt-0.5">Asgari analiz eşiği: 40/100, Sinyal üretme eşiği: 55/100</p>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">{dataQuality.score}/100</div>
            </div>

            {/* Factors Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Örneklem Yeterliliği</span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {dataQuality.factors.sampleSufficiency} / 30 Puan
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Veri Tazeliği</span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {dataQuality.factors.freshnessScore} / 20 Puan
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">H2H Kapsamı</span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {dataQuality.factors.h2hCoverage} / 15 Puan
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Lig Bazı Kapsamı</span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {dataQuality.factors.leagueBaselineCoverage} / 15 Puan
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Sağlayıcı Güvenilirliği</span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {dataQuality.factors.providerReliability} / 10 Puan
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">xG & Sakatlık Verisi</span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {dataQuality.factors.xgAvailability + dataQuality.factors.injuryDataAvailability} / 10 Puan
                </span>
              </div>
            </div>

            {/* Warnings */}
            {dataQuality.warnings.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300">
                <div className="font-bold flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Veri Kalitesi Uyarıları</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                  {dataQuality.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Uncertainty Audit */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Belirsizlik & Risk Denetimi</h4>
            <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Model Belirsizliği</span>
                <span className="text-sm font-extrabold text-white mt-1 block">
                  {uncertainty.modelUncertainty.toFixed(3)}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Veri Belirsizliği</span>
                <span className="text-sm font-extrabold text-white mt-1 block">
                  {uncertainty.dataUncertainty.toFixed(3)}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Toplam Birleşik Belirsizlik</span>
                <span className="text-sm font-extrabold text-amber-400 mt-1 block">
                  {uncertainty.combinedUncertainty.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: AI CONTEXTUAL EXPLANATION */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'AI' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Gemini Yapay Zeka Yorumu</h4>
                  <span className="text-[10px] text-slate-400">Yalnızca doğrulanmış matematiksel verileri açıklar</span>
                </div>
              </div>

              {!aiExplanation && (
                <button
                  id="btn-request-ai-explanation"
                  onClick={onRequestAIExplanation}
                  disabled={isLoadingAI}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isLoadingAI ? 'animate-spin' : ''}`} />
                  <span>{isLoadingAI ? 'Üretiliyor...' : 'Yorumu Oluştur'}</span>
                </button>
              )}
            </div>

            {isLoadingAI ? (
              <div className="py-12 text-center">
                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Gemini modelleri ve risk faktörlerini değerlendiriyor...</p>
              </div>
            ) : aiExplanation ? (
              <div className="space-y-4 text-xs text-slate-300">
                {/* Summary */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <h5 className="font-bold text-white mb-1">Genel İstatistiksel Değerlendirme</h5>
                  <p className="leading-relaxed text-slate-300">{aiExplanation.summary}</p>
                </div>

                {/* Tactical & Models */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <h5 className="font-bold text-slate-200 mb-1">Taktiksel & Saha Bağlamı</h5>
                    <p className="leading-relaxed text-slate-400 text-[11px]">{aiExplanation.tacticalContext}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <h5 className="font-bold text-slate-200 mb-1">Model Uzlaşı Analizi</h5>
                    <p className="leading-relaxed text-slate-400 text-[11px]">{aiExplanation.modelAgreementAnalysis}</p>
                  </div>
                </div>

                {/* Factors For & Against */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                    <h5 className="font-bold text-emerald-300 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Destekleyen Faktörler</span>
                    </h5>
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      {aiExplanation.factorsFor.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 shrink-0">&bull;</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40">
                    <h5 className="font-bold text-rose-300 mb-2 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Karşıt Risk Faktörleri</span>
                    </h5>
                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                      {aiExplanation.factorsAgainst.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-rose-400 shrink-0">&bull;</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-500 italic">
                  {aiExplanation.disclaimer}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Bu maç için henüz AI açıklaması oluşturulmadı. "Yorumu Oluştur" butonuna tıklayarak oluşturabilirsiniz.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provenance Footer */}
      <div className="border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono gap-2">
        <span>Kaynak: {analysis.provenance.provider} &bull; {analysis.provenance.freshness}</span>
        <span>Modeller: v{versions.modelVersion} &bull; Analiz: v{versions.analysisVersion} &bull; Konfig: v{versions.configVersion}</span>
      </div>
    </div>
  );
};
