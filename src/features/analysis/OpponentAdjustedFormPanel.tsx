// src/features/analysis/OpponentAdjustedFormPanel.tsx - Opponent-Adjusted Form (OAF v2.0) UI Panel
import React, { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp, Layers, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { MatchOpponentAdjustedForm } from '@/types';

interface OpponentAdjustedFormPanelProps {
  opponentAdjustedForm: MatchOpponentAdjustedForm;
  homeTeamName: string;
  awayTeamName: string;
}

export const OpponentAdjustedFormPanel: React.FC<OpponentAdjustedFormPanelProps> = ({
  opponentAdjustedForm,
  homeTeamName,
  awayTeamName,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { home, away, netFormAdvantage, combinedUncertainty, isReliable, abstainRecommendation, contextDisagreementNote } =
    opponentAdjustedForm;

  const getUncertaintyBadge = (level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    switch (level) {
      case 'LOW':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Belirsizlik: Düşük
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Belirsizlik: Orta
          </span>
        );
      case 'HIGH':
      case 'CRITICAL':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            Belirsizlik: Yüksek
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm mb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-950/70 border border-indigo-800/40 text-indigo-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">RAKİP AYARLI FORM (Opponent-Adjusted Form v2.0)</h4>
            <span className="text-[10px] text-slate-400">Karşılaşılan Rakiplerin Seviyesine ve Zaman Ağırlığına Göre Düzeltilmiş Form</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {abstainRecommendation ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/50 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              Yüksek Risk / Çekimser
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Form Üstünlüğü: {netFormAdvantage > 0 ? `+${netFormAdvantage} Ev` : netFormAdvantage < 0 ? `${netFormAdvantage} Dep` : 'Dengeli'}
            </span>
          )}
        </div>
      </div>

      {/* Main Two-Column Summary (Section 22 Specification) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* Home Team */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white truncate" title={homeTeamName}>
              {homeTeamName} <span className="text-[10px] text-slate-400 font-normal">(Ev)</span>
            </span>
            {getUncertaintyBadge(home.uncertaintyLevel)}
          </div>

          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Ham Form:</span>
            <span className="font-mono text-slate-300">{home.rawFormScore}/100</span>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <span className="text-xs font-semibold text-indigo-300">Rakip Ayarlı Form:</span>
            <span className="text-2xl font-black font-mono text-indigo-400">
              {home.adjustedFormScore}
              <span className="text-xs text-slate-500 font-normal">/100</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800/40">
            <span>Volatilite: %{home.formVolatility}</span>
            <span>Rakip Gücü Ort: {home.opponentStrengthAverage}</span>
          </div>
        </div>

        {/* Away Team */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white truncate" title={awayTeamName}>
              {awayTeamName} <span className="text-[10px] text-slate-400 font-normal">(Dep)</span>
            </span>
            {getUncertaintyBadge(away.uncertaintyLevel)}
          </div>

          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Ham Form:</span>
            <span className="font-mono text-slate-300">{away.rawFormScore}/100</span>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <span className="text-xs font-semibold text-cyan-300">Rakip Ayarlı Form:</span>
            <span className="text-2xl font-black font-mono text-cyan-400">
              {away.adjustedFormScore}
              <span className="text-xs text-slate-500 font-normal">/100</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800/40">
            <span>Volatilite: %{away.formVolatility}</span>
            <span>Rakip Gücü Ort: {away.opponentStrengthAverage}</span>
          </div>
        </div>
      </div>

      {/* Context Disagreement Note (if models or raw form diverge) */}
      {contextDisagreementNote && (
        <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-300 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span className="text-[11px]">{contextDisagreementNote}</span>
        </div>
      )}

      {/* Progressive Disclosure Toggle Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-300 transition-colors border border-slate-700/60"
      >
        <span className="font-semibold flex items-center gap-1.5 text-[11px]">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Ayrıntılı Form Parametreleri (Hücum, Savunma, Saha ve Volatilite)
        </span>
        {showDetails ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>

      {/* Progressive Disclosure Details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Ev Hücum / Savunma Formu</span>
              <span className="text-xs font-bold text-white font-mono mt-0.5 block">
                {home.attackForm} / {home.defenseForm}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Dep Hücum / Savunma Formu</span>
              <span className="text-xs font-bold text-white font-mono mt-0.5 block">
                {away.attackForm} / {away.defenseForm}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Ev Sahası Formu</span>
              <span className="text-xs font-bold text-indigo-400 font-mono mt-0.5 block">
                {home.homeFormScore}/100
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Deplasman Formu</span>
              <span className="text-xs font-bold text-cyan-400 font-mono mt-0.5 block">
                {away.awayFormScore}/100
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
            <div>
              <span className="font-semibold text-slate-300 block mb-0.5">Ev Sahibi Örneklem & Shrinkage:</span>
              <span>
                {home.sampleSize} maç analizi (Shrinkage: %{Math.round(home.shrinkageFactor * 100)}, Ağırlıklı Puan: {home.weightedPoints})
              </span>
            </div>
            <div>
              <span className="font-semibold text-slate-300 block mb-0.5">Deplasman Örneklem & Shrinkage:</span>
              <span>
                {away.sampleSize} maç analizi (Shrinkage: %{Math.round(away.shrinkageFactor * 100)}, Ağırlıklı Puan: {away.weightedPoints})
              </span>
            </div>
          </div>

          {/* Reasons / Insights List */}
          {(home.reasons.length > 0 || away.reasons.length > 0) && (
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 text-[11px] text-slate-300 space-y-1">
              <span className="font-semibold text-slate-400 text-[10px] uppercase block mb-1">Form Düzeltme Gerekçeleri:</span>
              {home.reasons.map((r, i) => (
                <div key={`hr-${i}`} className="flex items-start gap-1.5 text-slate-300">
                  <span className="text-indigo-400">•</span>
                  <span><strong>{homeTeamName}:</strong> {r}</span>
                </div>
              ))}
              {away.reasons.map((r, i) => (
                <div key={`ar-${i}`} className="flex items-start gap-1.5 text-slate-300">
                  <span className="text-cyan-400">•</span>
                  <span><strong>{awayTeamName}:</strong> {r}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
            <span>DTS ve Elo çifte sayma koruması: OAF bağımsız kısa/orta dönem düzeltilmiş sinyalidir.</span>
            <span className="font-mono">Metot: {home.methodVersion}</span>
          </div>
        </div>
      )}
    </div>
  );
};
