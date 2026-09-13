// src/components/ProviderDiagnosticStatus.tsx - Real-time provider health diagnostics and error display
import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Server, ShieldAlert } from 'lucide-react';
import { ProviderHealth } from '@/types';

interface ProviderDiagnosticStatusProps {
  fetchError?: string | null;
  providerHealth?: ProviderHealth[];
  onRetry?: () => void;
  compact?: boolean;
}

export const ProviderDiagnosticStatus: React.FC<ProviderDiagnosticStatusProps> = ({
  fetchError,
  providerHealth = [],
  onRetry,
  compact = false,
}) => {
  // If no error and compact mode, show simple badge line
  if (!fetchError && compact) {
    if (providerHealth.length === 0) return null;
    return (
      <div className="inline-flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
        <span className="text-slate-500 font-semibold flex items-center gap-1">
          <Server className="w-3 h-3" />
          <span>Sağlayıcılar:</span>
        </span>
        {providerHealth.map((p) => (
          <span
            key={p.name}
            className={`px-2 py-0.5 rounded-md border text-[10px] font-medium flex items-center gap-1 ${
              p.isConfigured
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${p.isConfigured ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span>{p.name}</span>
            <span>{p.isConfigured ? '✓' : '✗'}</span>
          </span>
        ))}
      </div>
    );
  }

  // Full error diagnostic display
  if (fetchError) {
    return (
      <div className="bg-rose-950/25 border-2 border-rose-500/40 rounded-2xl p-6 sm:p-7 text-center shadow-lg my-4 max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
        </div>

        <h3 className="text-base font-extrabold text-rose-200">Veri Sağlayıcı Bağlantı Hatası</h3>
        <p className="text-xs text-slate-400 mt-1">
          Maç bülteni API üzerinden alınamadı. Gerçek sunucu yanıtı:
        </p>

        <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-3.5 mt-3 text-left">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs font-mono text-rose-300 font-semibold break-words leading-relaxed">
              {fetchError}
            </div>
          </div>
        </div>

        {/* Diagnostic Bar: Provider status (/api/providers/status) */}
        <div className="mt-5 pt-4 border-t border-rose-500/20 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>Sağlayıcı Yapılandırma Durumu (/api/providers/status):</span>
            </span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Yeniden Dene</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {providerHealth && providerHealth.length > 0 ? (
              providerHealth.map((p) => (
                <div
                  key={p.name}
                  className={`p-2.5 rounded-xl border text-xs transition-all ${
                    p.isConfigured
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                      : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold truncate">{p.name}</span>
                    {p.isConfigured ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] mt-1 font-medium text-slate-400">
                    {p.isConfigured ? '🟢 Yapılandırıldı (Key OK)' : '🔴 Key Eksik / Tanımsız'}
                  </div>
                  {p.errorCount > 0 && (
                    <div className="text-[9px] text-rose-400 mt-0.5">
                      Hata: {p.errorCount} | Limit: {p.rateLimitCount}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-3 text-[11px] text-slate-400 text-center py-2 bg-slate-950/50 rounded-xl border border-slate-800">
                Sağlayıcı durumu sorgulanıyor...
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 text-left leading-relaxed">
          <strong className="text-slate-300 font-semibold block mb-0.5">Nasıl düzeltilir?</strong>
          Ortam değişkenleri (Settings &rarr; Secrets) bölümüne <code className="text-emerald-400 font-mono">FOOTBALL_DATA_ORG_KEY</code> veya <code className="text-emerald-400 font-mono">API_FOOTBALL_KEY</code> anahtarınızı ekleyin ve uygulamayı yeniden başlatın.
        </div>
      </div>
    );
  }

  // Normal empty state diagnostic line
  return (
    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col items-center gap-2.5 text-[11px] text-slate-400 max-w-lg mx-auto">
      <div className="inline-flex flex-wrap items-center justify-center gap-2">
        <span className="text-slate-500 font-semibold flex items-center gap-1">
          <Server className="w-3 h-3" />
          <span>Sağlayıcı Durumu:</span>
        </span>
        {providerHealth && providerHealth.length > 0 ? (
          providerHealth.map((p) => {
            const hasError = p.errorCount > 0 && Boolean(p.lastFailure);
            const isSuspended = p.lastFailure?.toLowerCase().includes('suspended') || p.lastFailure?.toLowerCase().includes('askı');
            
            let statusBadge = 'Pasif (Key Yok)';
            let badgeClass = 'bg-slate-950 border-slate-800 text-slate-500';
            let dotClass = 'bg-slate-600';

            if (p.isConfigured) {
              if (hasError) {
                statusBadge = isSuspended ? 'Askıya Alındı' : 'Hata';
                badgeClass = 'bg-rose-950/40 border-rose-800/60 text-rose-400';
                dotClass = 'bg-rose-500 animate-pulse';
              } else {
                statusBadge = 'Aktif';
                badgeClass = 'bg-slate-950 border-emerald-800/50 text-emerald-400';
                dotClass = 'bg-emerald-400';
              }
            }

            return (
              <span
                key={p.name}
                title={p.lastFailure || (p.isConfigured ? 'Bağlantı başarılı' : 'API anahtarı eksik')}
                className={`px-2.5 py-0.5 rounded-md border text-[10px] font-medium flex items-center gap-1.5 transition-colors cursor-help ${badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <span>{p.name}: {statusBadge}</span>
              </span>
            );
          })
        ) : (
          <span className="text-slate-600 text-[10px]">Sağlayıcılar kontrol ediliyor...</span>
        )}
      </div>

      {/* Warning banner if a configured provider failed */}
      {providerHealth && providerHealth.some((p) => p.isConfigured && p.errorCount > 0 && p.lastFailure) && (
        <div className="w-full text-left bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Sağlayıcı Uyarısı:</span>
          </div>
          {providerHealth
            .filter((p) => p.isConfigured && p.errorCount > 0 && p.lastFailure)
            .map((p) => (
              <p key={p.name} className="text-[11px] text-slate-300 font-mono break-all mt-0.5">
                <span className="font-semibold text-rose-300">{p.name}:</span> {p.lastFailure}
              </p>
            ))}
        </div>
      )}
    </div>
  );
};
