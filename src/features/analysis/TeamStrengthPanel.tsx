// src/features/analysis/TeamStrengthPanel.tsx - Dynamic Team Strength UI Panel
import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, Activity, Info, AlertTriangle, Layers } from 'lucide-react';
import { MatchTeamStrength } from '@/types';

interface TeamStrengthPanelProps {
  teamStrength: MatchTeamStrength;
  homeTeamName: string;
  awayTeamName: string;
}

export const TeamStrengthPanel: React.FC<TeamStrengthPanelProps> = ({
  teamStrength,
  homeTeamName,
  awayTeamName,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { home, away, netStrengthAdvantage, modelDisagreementNote } = teamStrength;

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
          <div className="p-1.5 rounded-lg bg-emerald-950/70 border border-emerald-800/40 text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">TAKIM GÜCÜ (Dynamic Team Strength)</h4>
            <span className="text-[10px] text-slate-400">Rakip Kalitesi ve Saha Koşullarına Göre Düzeltilmiş Dinamik Kapasite</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            Net Fark: {netStrengthAdvantage > 0 ? `+${netStrengthAdvantage} Ev` : netStrengthAdvantage < 0 ? `${netStrengthAdvantage} Dep` : 'Dengeli'}
          </span>
        </div>
      </div>

      {/* Main Two-Column Summary (Section 22 Specification) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* Home Team */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-white truncate" title={homeTeamName}>
              {homeTeamName} <span className="text-[10px] text-slate-400 font-normal">(Ev)</span>
            </span>
            {getUncertaintyBadge(home.uncertaintyLevel)}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xs text-slate-400">Güç Skoru:</span>
            <span className="text-2xl font-black font-mono text-emerald-400">
              {home.overallStrength}<span className="text-xs text-slate-500 font-normal">/100</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 pt-1.5 border-t border-slate-800/60">
            <span>Rakip Ayarlı Güç:</span>
            <span className="font-mono text-slate-200">{home.opponentAdjustedStrength}/100</span>
          </div>
        </div>

        {/* Away Team */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-white truncate" title={awayTeamName}>
              {awayTeamName} <span className="text-[10px] text-slate-400 font-normal">(Dep)</span>
            </span>
            {getUncertaintyBadge(away.uncertaintyLevel)}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xs text-slate-400">Güç Skoru:</span>
            <span className="text-2xl font-black font-mono text-sky-400">
              {away.overallStrength}<span className="text-xs text-slate-500 font-normal">/100</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 pt-1.5 border-t border-slate-800/60">
            <span>Rakip Ayarlı Güç:</span>
            <span className="font-mono text-slate-200">{away.opponentAdjustedStrength}/100</span>
          </div>
        </div>
      </div>

      {/* Disagreement Warning Note (if models diverge) */}
      {modelDisagreementNote && (
        <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-[11px]">{modelDisagreementNote}</span>
        </div>
      )}

      {/* Progressive Disclosure Toggle Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-300 transition-colors border border-slate-700/60"
      >
        <span className="font-semibold flex items-center gap-1.5 text-[11px]">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Ayrıntılı Güç Parametreleri (Hücum, Savunma, Saha ve Shrinkage)
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
              <span className="text-slate-400 text-[10px] block">Ev Hücum / Savunma</span>
              <span className="text-xs font-bold text-white font-mono mt-0.5 block">
                {home.attackStrength} / {home.defenseStrength}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Dep Hücum / Savunma</span>
              <span className="text-xs font-bold text-white font-mono mt-0.5 block">
                {away.attackStrength} / {away.defenseStrength}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Ev Sahası Gücü</span>
              <span className="text-xs font-bold text-emerald-400 font-mono mt-0.5 block">
                {home.homeStrength}/100
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Deplasman Gücü</span>
              <span className="text-xs font-bold text-sky-400 font-mono mt-0.5 block">
                {away.awayStrength}/100
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
            <div>
              <span className="font-semibold text-slate-300 block mb-0.5">Ev Sahibi Örneklem & Shrinkage:</span>
              <span>{home.sampleSize} maç analizi (Shrinkage: %{Math.round(home.shrinkageFactor * 100)})</span>
            </div>
            <div>
              <span className="font-semibold text-slate-300 block mb-0.5">Deplasman Örneklem & Shrinkage:</span>
              <span>{away.sampleSize} maç analizi (Shrinkage: %{Math.round(away.shrinkageFactor * 100)})</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
            <span>Çifte sayma koruması: Saha avantajı Poisson/HomeAway ile izole edilmiştir.</span>
            <span className="font-mono">Metot: {home.methodVersion}</span>
          </div>
        </div>
      )}
    </div>
  );
};
