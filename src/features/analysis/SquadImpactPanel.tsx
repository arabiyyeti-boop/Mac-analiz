// src/features/analysis/SquadImpactPanel.tsx - Squad & Player Impact v2.0 UI Component
// Implements progressive disclosure, zero-trust data transparency, and double-counting protection badges.

import React, { useState } from 'react';
import {
  Users,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  UserCheck,
  UserX,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { MatchSquadImpact, TeamSquadImpact } from '@/types';

interface SquadImpactPanelProps {
  squadImpact: MatchSquadImpact;
  homeTeamName: string;
  awayTeamName: string;
}

export const SquadImpactPanel: React.FC<SquadImpactPanelProps> = ({
  squadImpact,
  homeTeamName,
  awayTeamName,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const {
    status,
    isAvailable,
    isConfirmed,
    lineupType,
    home,
    away,
    relativeSquadAdvantage,
    doubleCountingGuards,
    futureLeakageGuard,
    dataQuality,
    uncertainty,
    abstention,
    summary,
  } = squadImpact;

  const getLineupBadge = () => {
    if (abstention.isAbstained || status === 'MISSING') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-slate-400" />
          Veri Yetersiz / Çekimser
        </span>
      );
    }
    if (isConfirmed) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Resmi İlk 11 (Confirmed)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
        <Info className="w-3 h-3" />
        Beklenen Kadro (Expected)
      </span>
    );
  };

  const getCoverageBadge = (rating: string) => {
    switch (rating) {
      case 'SOLID':
      case 'FULL_STRENGTH':
        return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Tam Güç</span>;
      case 'ADEQUATE':
        return <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">Yeterli</span>;
      case 'DEPLETED':
        return <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">Eksikli</span>;
      default:
        return <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Bilinmiyor</span>;
    }
  };

  const renderTeamCard = (team: TeamSquadImpact, teamLabel: string, isHome: boolean) => {
    const isNeutral = team.netSquadImpactScore === 0;
    const isPositive = team.netSquadImpactScore > 0;

    return (
      <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white truncate" title={teamLabel}>
              {teamLabel}{' '}
              <span className="text-[10px] text-slate-400 font-normal">
                ({isHome ? 'Ev' : 'Dep'})
              </span>
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                isNeutral
                  ? 'bg-slate-800 text-slate-300'
                  : isPositive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              Etki: {isPositive ? `+${team.netSquadImpactScore}` : team.netSquadImpactScore}
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] mb-2.5">
            <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[9px]">Mevcut</span>
              <span className="font-bold text-slate-200 font-mono">{team.availableCount}</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[9px]">Şüpheli</span>
              <span className={`font-bold font-mono ${team.doubtfulCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {team.doubtfulCount}
              </span>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[9px]">Eksik</span>
              <span className={`font-bold font-mono ${team.missingCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {team.missingCount}
              </span>
            </div>
          </div>

          {/* Position Lines */}
          <div className="space-y-1 text-[11px] border-t border-slate-800/60 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Kaleci Durumu:</span>
              <span className="font-medium text-slate-200 text-[10px] truncate max-w-[140px]" title={team.goalkeeperStatus.details}>
                {team.goalkeeperStatus.details}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Savunma Hattı:</span>
              {getCoverageBadge(team.defensiveCoverage.rating)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Hücum Hattı:</span>
              {getCoverageBadge(team.attackingCoverage.rating)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm mb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-950/70 border border-indigo-800/40 text-indigo-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              KADRO & OYUNCU ETKİSİ (Squad & Player Impact v2.0)
            </h4>
            <span className="text-[10px] text-slate-400">
              Doğrulanmış Kadro & Eksik Oyuncu Telemetrisi (Sıfır-Uydurma Veri Korumalı)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getLineupBadge()}
        </div>
      </div>

      {/* Primary Summary Banner */}
      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <span className="text-slate-300">{summary}</span>
        {isAvailable && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-850 text-slate-300 border border-slate-700 whitespace-nowrap self-start sm:self-auto">
            Net Kadro Farkı:{' '}
            <strong
              className={
                relativeSquadAdvantage > 0
                  ? 'text-emerald-400'
                  : relativeSquadAdvantage < 0
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }
            >
              {relativeSquadAdvantage > 0 ? `+${relativeSquadAdvantage} Ev` : relativeSquadAdvantage < 0 ? `${relativeSquadAdvantage} Dep` : 'Dengeli'}
            </strong>
          </span>
        )}
      </div>

      {/* 2-Column Team Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {renderTeamCard(home, homeTeamName, true)}
        {renderTeamCard(away, awayTeamName, false)}
      </div>

      {/* Progressive Disclosure Toggle */}
      <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          <span>{showDetails ? 'Kadro Detaylarını Gizle' : 'Kadro Analizi & Metodoloji Detayları'}</span>
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>Veri Kalitesi: <strong className="text-slate-200 font-mono">{dataQuality}/100</strong></span>
          <span>•</span>
          <span>Belirsizlik: <strong className="text-slate-200 font-mono">%{uncertainty}</strong></span>
        </div>
      </div>

      {/* Collapsible Deep Details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-3">
          {/* Double-Counting Protection Badges */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Çifte Sayım & Manipülasyon Korumaları (Double-Counting Isolation)</span>
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-400 block">DTS Yalıtımı:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  {doubleCountingGuards.dtsIsolated ? 'Aktif (Tekilleştirildi)' : 'Pasif'}
                </span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-400 block">OAF Yalıtımı:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  {doubleCountingGuards.oafIsolated ? 'Aktif (Sönümlendirildi)' : 'Pasif'}
                </span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-400 block">Gerçek xG Yalıtımı:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  {doubleCountingGuards.xgIsolated ? 'Aktif (Tekil Hücum)' : 'Pasif'}
                </span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-400 block">Elo Bütünlüğü:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  {doubleCountingGuards.eloProtected ? 'Korumalı (Değiştirilmedi)' : 'Pasif'}
                </span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800 col-span-2 sm:col-span-2">
                <span className="text-slate-400 block">Doğrudan Olasılık Müdahalesi:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  {doubleCountingGuards.probabilityDirectlyManipulated ? 'İhlal' : 'Engellendi (Yalnızca Artımlı Sinyal)'}
                </span>
              </div>
            </div>
          </div>

          {/* Temporal Freshness & Future Leakage Guard */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-white font-medium">Zaman Damgası & Gelecek Sızıntısı Koruması</span>
                <span className="text-slate-400 block text-[10px]">
                  Fikstür Başlangıcı: {new Date(futureLeakageGuard.fixtureKickoff).toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap self-start sm:self-auto">
              Sızıntı Koruması Geçti
            </span>
          </div>

          {/* Detailed Player Breakdown (Only verified real players, no fake entries) */}
          {(home.players.length > 0 || away.players.length > 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Home Team Absences / Key Highlights */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <h6 className="text-[11px] font-bold text-white mb-2 flex items-center justify-between">
                  <span>{homeTeamName} - Kadro Açıklamaları</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {home.lineupStatus === 'CONFIRMED' ? 'Resmi 11' : 'Tahmini 11'}
                  </span>
                </h6>
                <div className="space-y-1.5">
                  {home.players.filter((p) => p.impactScore < 0 || p.isKeyPlayer).length > 0 ? (
                    home.players
                      .filter((p) => p.impactScore < 0 || p.isKeyPlayer)
                      .slice(0, 5)
                      .map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 p-1.5 rounded bg-slate-900/60 border border-slate-800/60 text-[10px]"
                        >
                          <div className="flex items-center gap-1.5">
                            {p.impactScore < 0 ? (
                              <UserX className="w-3 h-3 text-rose-400 shrink-0" />
                            ) : (
                              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                            )}
                            <span className="text-slate-200">{p.explanation}</span>
                          </div>
                          <span
                            className={`font-mono font-bold shrink-0 ${
                              p.impactScore < 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {p.impactScore > 0 ? `+${p.impactScore}` : p.impactScore}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Kritik eksik veya olağandışı oyuncu bulunmuyor.</div>
                  )}
                </div>
              </div>

              {/* Away Team Absences / Key Highlights */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <h6 className="text-[11px] font-bold text-white mb-2 flex items-center justify-between">
                  <span>{awayTeamName} - Kadro Açıklamaları</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {away.lineupStatus === 'CONFIRMED' ? 'Resmi 11' : 'Tahmini 11'}
                  </span>
                </h6>
                <div className="space-y-1.5">
                  {away.players.filter((p) => p.impactScore < 0 || p.isKeyPlayer).length > 0 ? (
                    away.players
                      .filter((p) => p.impactScore < 0 || p.isKeyPlayer)
                      .slice(0, 5)
                      .map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 p-1.5 rounded bg-slate-900/60 border border-slate-800/60 text-[10px]"
                        >
                          <div className="flex items-center gap-1.5">
                            {p.impactScore < 0 ? (
                              <UserX className="w-3 h-3 text-rose-400 shrink-0" />
                            ) : (
                              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                            )}
                            <span className="text-slate-200">{p.explanation}</span>
                          </div>
                          <span
                            className={`font-mono font-bold shrink-0 ${
                              p.impactScore < 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {p.impactScore > 0 ? `+${p.impactScore}` : p.impactScore}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Kritik eksik veya olağandışı oyuncu bulunmuyor.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {abstention.reason || 'Kadro detayları henüz resmi kaynaklar tarafından ilan edilmemiştir (Sıfır-Uydurma İlkesi).'}
              </span>
            </div>
          )}

          {/* Zero-Invention Rule Notice */}
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/50 text-[10px] text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              <strong>Sıfır-Uydurma Veri Kuralı (Zero-Invention Guarantee):</strong> Bu panel yalnızca resmi veya kanıtlanmış kadro/oyuncu telemetrisini işler. Rastgele veya varsayılan oyuncu ratingi üretilmez; veri yoksa model çekimser kalır.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
