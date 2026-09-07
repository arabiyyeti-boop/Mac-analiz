// src/features/favorites/FavoritesView.tsx - Favorited Matches
import React from 'react';
import { Star, ChevronRight, Clock, Shield } from 'lucide-react';
import { CanonicalMatch } from '@/types';

interface FavoritesViewProps {
  favorites: string[];
  allMatches: CanonicalMatch[];
  onSelectMatch: (match: CanonicalMatch) => void;
  onToggleFavorite: (matchId: string) => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  allMatches,
  onSelectMatch,
  onToggleFavorite,
}) => {
  const favoriteMatches = allMatches.filter((m) => favorites.includes(m.id));

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          <h2 className="text-base font-bold text-white">Favori Maçlarım ({favoriteMatches.length})</h2>
        </div>
        <p className="text-xs text-slate-400">
          Takip etmek üzere işaretlediğiniz maçlar burada saklanır. Çevrimdışı durumlarda da erişilebilir.
        </p>
      </div>

      {favoriteMatches.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center">
          <Star className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">Henüz Favori Maç Eklenmedi</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            "Bülten" sekmesindeki maçların yanındaki yıldız simgesine tıklayarak favorilerinize ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {favoriteMatches.map((match) => (
            <div
              key={match.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300">{match.league.name}</span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(match.utcDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-white truncate">{match.homeTeam.name}</span>
                  <span className="text-xs font-bold text-slate-500">vs</span>
                  <span className="font-bold text-sm text-white truncate text-right">{match.awayTeam.name}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                <button
                  onClick={() => onToggleFavorite(match.id)}
                  className="p-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                  title="Favorilerden Çıkar"
                >
                  <Star className="w-4 h-4 fill-amber-400" />
                </button>

                <button
                  onClick={() => onSelectMatch(match)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                >
                  <span>Analiz</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
