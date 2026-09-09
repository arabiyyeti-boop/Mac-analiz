// src/features/matches/MatchesView.tsx - Fixtures & Match Selector
import React, { useState } from 'react';
import { Search, Calendar as CalendarIcon, Star, ChevronRight, Clock, Shield, Tag } from 'lucide-react';
import { CanonicalMatch } from '@/types';
import { TeamLogo } from '@/components/TeamLogo';

interface MatchesViewProps {
  matches: CanonicalMatch[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onSelectMatch: (match: CanonicalMatch) => void;
  favorites: string[];
  onToggleFavorite: (matchId: string) => void;
  isLoading: boolean;
}

export const MatchesView: React.FC<MatchesViewProps> = ({
  matches,
  selectedDate,
  onDateChange,
  onSelectMatch,
  favorites,
  onToggleFavorite,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<string>('ALL');

  // Extract unique leagues
  const leagues = Array.from(new Set(matches.map((m) => m.league.name))).sort();

  // Filter matches
  const filteredMatches = matches.filter((m) => {
    const matchesSearch =
      m.homeTeam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.awayTeam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.league.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLeague = selectedLeague === 'ALL' || m.league.name === selectedLeague;

    return matchesSearch && matchesLeague;
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  return (
    <div className="space-y-5 pb-20">
      {/* Date Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          id="btn-date-yesterday"
          onClick={() => onDateChange(yesterdayStr)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            selectedDate === yesterdayStr
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Dün
        </button>
        <button
          id="btn-date-today"
          onClick={() => onDateChange(todayStr)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            selectedDate === todayStr
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Bugün
        </button>
        <button
          id="btn-date-tomorrow"
          onClick={() => onDateChange(tomorrowStr)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            selectedDate === tomorrowStr
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Yarın
        </button>
        <div className="flex items-center gap-1.5 ml-auto text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
          <span>{selectedDate}</span>
        </div>
      </div>

      {/* Search & League Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="input-match-search"
            type="text"
            placeholder="Takım veya lig ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {leagues.length > 0 && (
          <select
            id="select-league-filter"
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Tüm Ligler ({matches.length})</option>
            {leagues.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Matches List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Maç bülteni alınıyor ve doğrulanıyor...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
          <Shield className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">Maç Bulunamadı</h3>
          <p className="text-xs text-slate-400 mt-1">
            Seçili tarih veya arama kriterine uygun futbol maçı bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map((match) => {
            const isFav = favorites.includes(match.id);
            const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
            const isFinished = match.status === 'FINISHED';

            return (
              <div
                key={match.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
                    <span className="font-semibold text-slate-300 truncate">{match.league.name}</span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 font-mono text-slate-400">
                      <Clock className="w-3 h-3" />
                      {new Date(match.utcDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {isLive && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[9px] border border-rose-500/40 animate-pulse">
                        CANLI {match.minute ? `${match.minute}'` : ''}
                      </span>
                    )}

                    {isFinished && (
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold text-[9px]">
                        BİTTİ
                      </span>
                    )}
                  </div>

                  {/* Teams & Score */}
                  <div className="grid grid-cols-5 items-center gap-2">
                    <div className="col-span-2 flex items-center gap-2 min-w-0">
                      <TeamLogo teamName={match.homeTeam.name} crestUrl={match.homeTeam.crest} size="sm" />
                      <span className="font-bold text-sm text-white truncate">{match.homeTeam.name}</span>
                    </div>

                    <div className="col-span-1 text-center font-mono font-extrabold text-sm">
                      {match.score?.fullTime?.home !== null && match.score?.fullTime?.home !== undefined ? (
                        <span className="text-emerald-400">
                          {match.score.fullTime.home} - {match.score.fullTime.away}
                        </span>
                      ) : (
                        <span className="text-slate-600">vs</span>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2 min-w-0">
                      <span className="font-bold text-sm text-white truncate text-right">{match.awayTeam.name}</span>
                      <TeamLogo teamName={match.awayTeam.name} crestUrl={match.awayTeam.crest} size="sm" />
                    </div>
                  </div>

                  {/* Nesine Oranları (1, X, 2) or VERİ MEVCUT DEĞİL - Item 131 */}
                  <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] font-semibold text-slate-400">Nesine:</span>
                    {match.odds && match.odds.homeWin && match.odds.draw && match.odds.awayWin ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700/60">
                          1: <span className="text-amber-400">{match.odds.homeWin.toFixed(2)}</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700/60">
                          X: <span className="text-amber-400">{match.odds.draw.toFixed(2)}</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700/60">
                          2: <span className="text-amber-400">{match.odds.awayWin.toFixed(2)}</span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                        VERİ MEVCUT DEĞİL
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
                  <button
                    id={`btn-fav-${match.id}`}
                    onClick={() => onToggleFavorite(match.id)}
                    className={`p-2 rounded-xl transition-colors ${
                      isFav ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
                    }`}
                    title={isFav ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                  </button>

                  <button
                    id={`btn-analyze-${match.id}`}
                    onClick={() => onSelectMatch(match)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                  >
                    <span>Analiz Et</span>
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
