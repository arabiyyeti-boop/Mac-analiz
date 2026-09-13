// src/features/analysis/AdvancedXGPanel.tsx - Advanced xG v2.0 UI Component
// Features strict separation of Real xG vs Model Expected Goals with Progressive Disclosure

import React, { useState } from 'react';
import { Target, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, ShieldCheck, HelpCircle, Activity } from 'lucide-react';
import { MatchAdvancedXG } from '@/types';

interface AdvancedXGPanelProps {
  advancedXG: MatchAdvancedXG;
  homeTeamName: string;
  awayTeamName: string;
}

export const AdvancedXGPanel: React.FC<AdvancedXGPanelProps> = ({
  advancedXG,
  homeTeamName,
  awayTeamName,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { status, isAvailable, home, away, modelExpectedGoals, provenance, dataQuality, uncertainty, sensitivityNote, reasons } =
    advancedXG;

  const getStatusBadge = () => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Gerçek xG Doğrulandı
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Kısmi xG Telemetrisi
          </span>
        );
      case 'MISSING':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-slate-400" />
            Gerçek xG: Mevcut Değil (No-Invention)
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm mb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-950/70 border border-teal-800/40 text-teal-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">ADVANCED xG v2.0 (Beklenen Goller)</h4>
            <span className="text-[10px] text-slate-400">Gerçek xG Telemetrisi & Ayrık Model Beklenen Gol (No-Invention Güvenceli)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
        </div>
      </div>

      {/* SECTION 1: Dual Concept Breakdown (Model Expected Goals vs Real xG) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* Card 1: Model Expected Goals (Poisson / Dixon-Coles) */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                MODEL_EXPECTED_GOALS
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40">
                Poisson & Dixon-Coles
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Lig ortalamaları ve takım skor parametrelerinden matematiksel olarak türetilen teorik gol beklentisi (&lambda;).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-center">
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block truncate" title={homeTeamName}>
                {homeTeamName} (Ev)
              </span>
              <span className="text-lg font-mono font-black text-sky-300">
                {modelExpectedGoals.home.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block truncate" title={awayTeamName}>
                {awayTeamName} (Dep)
              </span>
              <span className="text-lg font-mono font-black text-sky-300">
                {modelExpectedGoals.away.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Real xG (Provider Verified Telemetry) */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                REAL_xG (Sağlayıcı Verisi)
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {isAvailable ? (home.source || 'Doğrulanmış Sağlayıcı') : 'Veri Sağlayıcıda Yok'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              {isAvailable
                ? 'Harici doğrulanmış sağlayıcıdan şut bazlı pozisyon kalitesi telemetrisi.'
                : 'Harici sağlayıcıdan gerçek xG verisi bulunmuyor. No-Invention güvencesi devrede.'}
            </p>
          </div>

          {isAvailable && home.realXGFor !== undefined && away.realXGFor !== undefined ? (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-center">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block truncate" title={homeTeamName}>
                  {homeTeamName}
                </span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  {home.realXGFor.toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-500 block">xG Üretilen</span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block truncate" title={awayTeamName}>
                  {awayTeamName}
                </span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  {away.realXGFor.toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-500 block">xG Üretilen</span>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-800/60">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  <strong>No-Invention Kuralı:</strong> Sağlayıcıda gerçek şut xG verisi olmadığında sahte veri üretilmez. Model doğrudan bağımsız Poisson PMF ile çalışır.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Regression & Finishing Analysis (if Real xG Available) */}
      {isAvailable && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {/* Home Team Regression */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-white truncate">{homeTeamName}</span>
              <span className="text-[10px] text-slate-400 font-mono">Shrinkage: {home.shrinkageFactor}</span>
            </div>
            {home.regressionSignal && (
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                <span className="font-semibold text-teal-300 block mb-0.5">
                  {home.regressionSignal.type === 'NEGATIVE_REGRESSION'
                    ? '⚠️ Negatif Regresyon Riski (Yüksek Bitiricilik)'
                    : home.regressionSignal.type === 'POSITIVE_REGRESSION'
                    ? '📈 Pozitif Regresyon Potansiyeli (Düşük Verim)'
                    : '⚖️ Dengeli Bitiricilik'}
                </span>
                <span className="text-slate-400 text-[10px] leading-tight block">
                  {home.regressionSignal.note}
                </span>
              </div>
            )}
          </div>

          {/* Away Team Regression */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-white truncate">{awayTeamName}</span>
              <span className="text-[10px] text-slate-400 font-mono">Shrinkage: {away.shrinkageFactor}</span>
            </div>
            {away.regressionSignal && (
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                <span className="font-semibold text-cyan-300 block mb-0.5">
                  {away.regressionSignal.type === 'NEGATIVE_REGRESSION'
                    ? '⚠️ Negatif Regresyon Riski (Yüksek Bitiricilik)'
                    : away.regressionSignal.type === 'POSITIVE_REGRESSION'
                    ? '📈 Pozitif Regresyon Potansiyeli (Düşük Verim)'
                    : '⚖️ Dengeli Bitiricilik'}
                </span>
                <span className="text-slate-400 text-[10px] leading-tight block">
                  {away.regressionSignal.note}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: Progressive Disclosure Details */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full mt-1 py-1.5 px-3 bg-slate-950/50 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-800/70 rounded-xl text-xs flex items-center justify-between transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-teal-400" />
          <span>xG Metodolojisi, Doğrulama & Detaylar</span>
        </span>
        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase">Veri Kalitesi (DQ 2.0)</span>
              <span className="text-sm font-mono font-bold text-white">%{dataQuality}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase">Belirsizlik İndeksi</span>
              <span className="text-sm font-mono font-bold text-white">%{uncertainty}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase">Provenance / Sağlayıcı</span>
              <span className="text-sm font-mono font-bold text-white truncate block">
                {provenance?.provider || 'N/A'}
              </span>
            </div>
          </div>

          {sensitivityNote && (
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-400 block mb-0.5">Analitik Duyarlılık Notu:</span>
              {sensitivityNote}
            </div>
          )}

          {reasons && reasons.length > 0 && (
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Doğrulama Gerekçeleri:
              </span>
              <ul className="space-y-1">
                {reasons.map((r, idx) => (
                  <li key={idx} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                    <span className="text-teal-400 shrink-0">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
