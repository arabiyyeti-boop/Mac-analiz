// src/components/common/Header.tsx - Header with Branding & State Indicators
import React from 'react';
import { Activity, Wifi, WifiOff, SlidersHorizontal } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  isOnline: boolean;
  activeTabTitle: string;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isOnline, activeTabTitle, onOpenSettings }) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/40">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white">MAÇ ANALİZ PRO</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                v1.0.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {activeTabTitle} &bull; İstatistiksel Tahmin Motoru
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status badge */}
          <div
            id="status-connection-badge"
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-slate-800/80 text-emerald-400 border-emerald-900/50'
                : 'bg-rose-950/50 text-rose-300 border-rose-800/60'
            }`}
          >
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi className="w-3.5 h-3.5" />
                <span>Çevrimiçi</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Çevrimdışı (Önbellek)</span>
              </>
            )}
          </div>

          <PWAInstallButton />

          {onOpenSettings && (
            <button
              id="btn-header-settings"
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Ayarlar"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
