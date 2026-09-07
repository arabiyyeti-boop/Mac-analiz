// src/components/layout/BottomNavigation.tsx - Mobile-First Navigation
import React from 'react';
import { Home, Calendar, LineChart, Star, History, SlidersHorizontal } from 'lucide-react';

export type NavTab = 'dashboard' | 'matches' | 'analysis' | 'favorites' | 'ledger' | 'settings';

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  favoritesCount: number;
  hasSelectedMatch: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  favoritesCount,
  hasSelectedMatch,
}) => {
  const tabs: Array<{ id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }> = [
    { id: 'dashboard', label: 'Genel Bakış', icon: Home },
    { id: 'matches', label: 'Bülten', icon: Calendar },
    { id: 'analysis', label: 'Analiz', icon: LineChart },
    { id: 'favorites', label: 'Favoriler', icon: Star, badge: favoritesCount > 0 ? favoritesCount : undefined },
    { id: 'ledger', label: 'Ledger', icon: History },
    { id: 'settings', label: 'Ayarlar', icon: SlidersHorizontal },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-slate-950 text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
                {tab.id === 'analysis' && hasSelectedMatch && !isActive && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
