// src/features/home/MainHomeView.tsx - Maçkolik-Inspired Streamlined Matches & Leagues View
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Star,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  X,
  Radio,
  Trophy,
} from 'lucide-react';
import { CanonicalMatch, ProviderHealth } from '@/types';
import { MatchCard } from '@/features/matches/MatchCard';
import { ProviderDiagnosticStatus } from '@/components/ProviderDiagnosticStatus';
import {
  classifyLeague,
  LEAGUE_CATEGORIES,
  isMainBulletinCompetition,
  isNegativeFilteredMatch,
} from '@/utils/leagueHierarchy';

export type QuickFilter = 'ALL' | 'FAVORITES' | 'TODAY' | 'TOMORROW' | 'LIVE' | 'YESTERDAY';

interface MainHomeViewProps {
  matches: CanonicalMatch[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onSelectMatch: (match: CanonicalMatch) => void;
  favorites: string[];
  onToggleFavorite: (matchId: string) => void;
  isLoading: boolean;
  initialCategory?: string;
  focusSearch?: boolean;
  fetchError?: string | null;
  providerHealth?: ProviderHealth[];
  onRetry?: () => void;
}

export const MainHomeView: React.FC<MainHomeViewProps> = ({
  matches,
  selectedDate,
  onDateChange,
  onSelectMatch,
  favorites,
  onToggleFavorite,
  isLoading,
  initialCategory = 'ALL',
  focusSearch = false,
  fetchError,
  providerHealth,
  onRetry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('TODAY');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});
  const [favoriteLeagues, setFavoriteLeagues] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mac_analiz_fav_leagues');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => new Date(Date.now() - 86400000).toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => new Date(Date.now() + 86400000).toISOString().split('T')[0], []);

  // Sync activeFilter with selectedDate
  useEffect(() => {
    if (selectedDate === todayStr && activeFilter !== 'FAVORITES' && activeFilter !== 'LIVE') {
      setActiveFilter('TODAY');
    } else if (selectedDate === tomorrowStr && activeFilter !== 'FAVORITES' && activeFilter !== 'LIVE') {
      setActiveFilter('TOMORROW');
    } else if (selectedDate === yesterdayStr && activeFilter !== 'FAVORITES' && activeFilter !== 'LIVE') {
      setActiveFilter('YESTERDAY');
    }
  }, [selectedDate, todayStr, tomorrowStr, yesterdayStr]);

  // Persist favorite leagues
  const toggleFavoriteLeague = (leagueName: string) => {
    setFavoriteLeagues((prev) => {
      const updated = prev.includes(leagueName)
        ? prev.filter((name) => name !== leagueName)
        : [...prev, leagueName];
      try {
        localStorage.setItem('mac_analiz_fav_leagues', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const toggleCollapseLeague = (leagueKey: string) => {
    setCollapsedLeagues((prev) => ({
      ...prev,
      [leagueKey]: !prev[leagueKey],
    }));
  };

  const handleFilterClick = (filter: QuickFilter) => {
    setActiveFilter(filter);
    if (filter === 'TODAY') onDateChange(todayStr);
    else if (filter === 'TOMORROW') onDateChange(tomorrowStr);
    else if (filter === 'YESTERDAY') onDateChange(yesterdayStr);
  };

  // Group and filter matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // 1. Competition / Bulletin Filter (Sections 5, 6, 7, 8)
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        // Broad search enabled by user query; protect with strict negative filter
        const matchesQuery =
          m.homeTeam.name.toLowerCase().includes(query) ||
          m.awayTeam.name.toLowerCase().includes(query) ||
          m.league.name.toLowerCase().includes(query) ||
          (m.league.country && m.league.country.toLowerCase().includes(query));
        if (!matchesQuery) return false;

        if (isNegativeFilteredMatch(m.league.name, m.homeTeam.name, m.awayTeam.name, m.league.country)) {
          return false;
        }
      } else {
        // Main Bulletin: Strictly 1st & 2nd tiers + Top 3 UEFA competitions (Exclude ambiguous or sub-tiers)
        const isAllowed = isMainBulletinCompetition(
          m.league.name,
          m.league.country,
          m.homeTeam.name,
          m.awayTeam.name
        );
        if (!isAllowed) return false;
      }

      // 2. Quick tab filter
      if (activeFilter === 'FAVORITES') {
        if (!favorites.includes(m.id)) return false;
      } else if (activeFilter === 'LIVE') {
        const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
        if (!isLive) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === 'FAV_LEAGUES') {
          if (!favoriteLeagues.includes(m.league.name)) return false;
        } else {
          const cat = classifyLeague(m.league.name, m.league.country);
          if (cat.id !== selectedCategory) return false;
        }
      }

      return true;
    });
  }, [matches, searchQuery, activeFilter, selectedCategory, favorites, favoriteLeagues]);

  // Group matches by league
  const leagueGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        leagueName: string;
        country?: string;
        category: any;
        matches: CanonicalMatch[];
      }
    > = {};

    filteredMatches.forEach((m) => {
      const key = `${m.league.country || 'world'}_${m.league.name}`;
      if (!groups[key]) {
        groups[key] = {
          leagueName: m.league.name,
          country: m.league.country,
          category: classifyLeague(m.league.name, m.league.country),
          matches: [],
        };
      }
      groups[key].matches.push(m);
    });

    // Sort leagues: Favorite leagues first, then by category priority, then alphabetical
    return Object.entries(groups).sort(([, a], [, b]) => {
      const isFavA = favoriteLeagues.includes(a.leagueName);
      const isFavB = favoriteLeagues.includes(b.leagueName);
      if (isFavA && !isFavB) return -1;
      if (!isFavA && isFavB) return 1;

      if (a.category.priority !== b.category.priority) {
        return a.category.priority - b.category.priority;
      }
      return a.leagueName.localeCompare(b.leagueName);
    });
  }, [filteredMatches, favoriteLeagues]);

  // Total live matches count
  const liveCount = useMemo(() => {
    return matches.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED').length;
  }, [matches]);

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Top Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id="input-main-search"
          type="text"
          autoFocus={focusSearch}
          placeholder="Maç veya takım ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[44px]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Quick Filter Tabs: [⭐ Favoriler] [Bugün] [Yarın] [Canlı] */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          id="btn-filter-favorites"
          onClick={() => handleFilterClick('FAVORITES')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[38px] ${
            activeFilter === 'FAVORITES'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${activeFilter === 'FAVORITES' ? 'fill-slate-950' : 'fill-amber-400 text-amber-400'}`} />
          <span>Favoriler ({favorites.length})</span>
        </button>

        <button
          id="btn-filter-today"
          onClick={() => handleFilterClick('TODAY')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[38px] ${
            activeFilter === 'TODAY'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Bugün
        </button>

        <button
          id="btn-filter-tomorrow"
          onClick={() => handleFilterClick('TOMORROW')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[38px] ${
            activeFilter === 'TOMORROW'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Yarın
        </button>

        <button
          id="btn-filter-live"
          onClick={() => handleFilterClick('LIVE')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[38px] ${
            activeFilter === 'LIVE'
              ? 'bg-rose-500 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${liveCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
          <span>Canlı {liveCount > 0 ? `(${liveCount})` : ''}</span>
        </button>

        <button
          id="btn-filter-yesterday"
          onClick={() => handleFilterClick('YESTERDAY')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeFilter === 'YESTERDAY'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Dün
        </button>
      </div>

      {/* 3. League Categories Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          id="cat-btn-all"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
            selectedCategory === 'ALL'
              ? 'bg-slate-800 text-white font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tüm Ligler
        </button>

        {favoriteLeagues.length > 0 && (
          <button
            id="cat-btn-fav-leagues"
            onClick={() => setSelectedCategory('FAV_LEAGUES')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
              selectedCategory === 'FAV_LEAGUES'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>Favori Ligler ({favoriteLeagues.length})</span>
          </button>
        )}

        {Object.values(LEAGUE_CATEGORIES).map((cat) => (
          <button
            key={cat.id}
            id={`cat-btn-${cat.id.toLowerCase()}`}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
              selectedCategory === cat.id
                ? 'bg-slate-800 text-emerald-400 font-bold border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{cat.flag}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* 4. Match Count Summary */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>
          Toplam <strong className="text-white">{filteredMatches.length}</strong> maç listeleniyor
        </span>
        <span className="font-mono">{selectedDate}</span>
      </div>

      {/* 5. Matches Grouped by League (Maçkolik Style) */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Maç bülteni yükleniyor...</p>
        </div>
      ) : leagueGroups.length === 0 ? (
        fetchError ? (
          <ProviderDiagnosticStatus
            fetchError={fetchError}
            providerHealth={providerHealth}
            onRetry={onRetry}
          />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center shadow-xs">
            <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white">Maç Bulunamadı</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `"${searchQuery}" için eşleşen karşılaşma bulunamadı.`
                : 'Seçili tarihte veya lig kategorisinde maç bulunmuyor.'}
            </p>
            <ProviderDiagnosticStatus
              providerHealth={providerHealth}
              compact={false}
            />
          </div>
        )
      ) : (
        <div className="space-y-4">
          {leagueGroups.map(([key, group]) => {
            const isCollapsed = collapsedLeagues[key] || false;
            const isLeagueFav = favoriteLeagues.includes(group.leagueName);

            return (
              <div
                key={key}
                id={`league-group-${key.replace(/[^a-zA-Z0-9]/g, '-')}`}
                className="space-y-2"
              >
                {/* League Header */}
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-xs">
                  <div
                    onClick={() => toggleCollapseLeague(key)}
                    className="flex items-center gap-2 cursor-pointer select-none flex-1 min-w-0"
                  >
                    <span className="text-base">{group.category.flag}</span>
                    <span className="font-bold text-xs sm:text-sm text-slate-200 truncate">
                      {group.leagueName}
                    </span>
                    {group.country && (
                      <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                        ({group.country})
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 ml-1">
                      {group.matches.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      id={`btn-fav-league-${key}`}
                      onClick={() => toggleFavoriteLeague(group.leagueName)}
                      className={`p-1.5 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                        isLeagueFav
                          ? 'text-amber-400 hover:bg-amber-500/10'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={isLeagueFav ? 'Lig favorilerinden çıkar' : 'Ligi favorilere ekle'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isLeagueFav ? 'fill-amber-400' : ''}`} />
                    </button>

                    <button
                      onClick={() => toggleCollapseLeague(key)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title={isCollapsed ? 'Genişlet' : 'Daralt'}
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Match Cards in League */}
                {!isCollapsed && (
                  <div className="space-y-2 pl-0 sm:pl-1">
                    {group.matches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        isFavorite={favorites.includes(match.id)}
                        onToggleFavorite={onToggleFavorite}
                        onSelectMatch={onSelectMatch}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
