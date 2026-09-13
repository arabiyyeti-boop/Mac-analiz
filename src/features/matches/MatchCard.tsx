// src/features/matches/MatchCard.tsx - Simplified Maçkolik-Inspired Match Card
import React from 'react';
import { Star, Clock } from 'lucide-react';
import { CanonicalMatch } from '@/types';
import { TeamLogo } from '@/components/TeamLogo';

interface MatchCardProps {
  match: CanonicalMatch;
  isFavorite: boolean;
  onToggleFavorite: (matchId: string) => void;
  onSelectMatch: (match: CanonicalMatch) => void;
  showLeagueHeader?: boolean;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  isFavorite,
  onToggleFavorite,
  onSelectMatch,
  showLeagueHeader = false,
}) => {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED';
  const isPostponed = match.status === 'POSTPONED' || match.status === 'CANCELLED';

  const matchTime = new Date(match.utcDate).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const getStatusText = () => {
    if (isLive) return `CANLI ${match.minute ? `${match.minute}'` : ''}`;
    if (isFinished) return 'BİTTİ';
    if (isPostponed) return 'ERTELENDİ';
    return 'Başlamadı';
  };

  const getStatusBadge = () => {
    if (isLive) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/40 animate-pulse">
          {getStatusText()}
        </span>
      );
    }
    if (isFinished) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold text-[10px]">
          {getStatusText()}
        </span>
      );
    }
    if (isPostponed) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold text-[10px]">
          {getStatusText()}
        </span>
      );
    }
    return (
      <span className="text-[10px] text-slate-500 font-medium">
        {getStatusText()}
      </span>
    );
  };

  return (
    <div
      id={`match-card-${match.id}`}
      onClick={() => onSelectMatch(match)}
      className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-3.5 transition-all shadow-xs cursor-pointer active:scale-[0.99] select-none"
    >
      {/* Optional Top bar for League */}
      {showLeagueHeader && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 pb-1.5 border-b border-slate-800/60">
          <span className="font-semibold text-slate-300 truncate">{match.league.name}</span>
          <div className="flex items-center gap-1 font-mono text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{matchTime}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {/* Left: Time & Status */}
        <div className="flex flex-col items-start min-w-[58px] shrink-0">
          <span className="font-mono text-xs font-bold text-slate-200">
            {matchTime}
          </span>
          <div className="mt-0.5">{getStatusBadge()}</div>
        </div>

        {/* Center: Teams and Score */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Home team */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TeamLogo
                teamName={match.homeTeam.name}
                crestUrl={match.homeTeam.crest}
                canonicalTeamId={String(match.homeTeam.id)}
                size="xs"
              />
              <span className="font-semibold text-xs sm:text-sm text-white truncate">
                {match.homeTeam.name}
              </span>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-slate-200 shrink-0">
              {match.score?.fullTime?.home !== null && match.score?.fullTime?.home !== undefined
                ? match.score.fullTime.home
                : '-'}
            </span>
          </div>

          {/* Away team */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TeamLogo
                teamName={match.awayTeam.name}
                crestUrl={match.awayTeam.crest}
                canonicalTeamId={String(match.awayTeam.id)}
                size="xs"
              />
              <span className="font-semibold text-xs sm:text-sm text-white truncate">
                {match.awayTeam.name}
              </span>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-slate-200 shrink-0">
              {match.score?.fullTime?.away !== null && match.score?.fullTime?.away !== undefined
                ? match.score.fullTime.away
                : '-'}
            </span>
          </div>
        </div>

        {/* Right: Odds snapshot (if real) & Favorite toggle */}
        <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-slate-800/80">
          {match.odds && match.odds.homeWin && match.odds.draw && match.odds.awayWin ? (
            <div className="hidden sm:flex flex-col gap-1 text-[10px] font-mono text-slate-300">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">1</span>
                <span className="font-bold text-amber-400">{match.odds.homeWin.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">X</span>
                <span className="font-bold text-amber-400">{match.odds.draw.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">2</span>
                <span className="font-bold text-amber-400">{match.odds.awayWin.toFixed(2)}</span>
              </div>
            </div>
          ) : null}

          <button
            id={`btn-favorite-${match.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(match.id);
            }}
            className={`p-2 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isFavorite
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
            title={isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
