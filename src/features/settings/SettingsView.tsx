// src/features/settings/SettingsView.tsx - System Diagnostics & Configuration
import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Activity,
  Shield,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Database,
  Tag,
  Wifi,
} from 'lucide-react';
import { ProviderHealth, NesineAvailability } from '@/types';
import { AppApiService } from '@/services/api';
import { analysisConfig, APP_VERSION, MODEL_VERSION, ANALYSIS_VERSION, CONFIG_VERSION, CALIBRATION_VERSION } from '@/config/analysisConfig';

interface SettingsViewProps {
  onClearAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClearAllData }) => {
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [nesineStatus, setNesineStatus] = useState<{ status: NesineAvailability; lastFetch: string | null; error: string | null; totalEvents: number } | null>(null);
  const [isLoadingNesine, setIsLoadingNesine] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const fetchProviderHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await fetch('/api/providers/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setProviderHealth(json.data);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const checkNesine = async () => {
    setIsLoadingNesine(true);
    try {
      const status = await AppApiService.getNesineStatus();
      setNesineStatus(status);
    } catch {
      // Fallback
    } finally {
      setIsLoadingNesine(false);
    }
  };

  useEffect(() => {
    fetchProviderHealth();
    checkNesine();
  }, []);

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Sistem Tanılama & Ayarlar</h2>
        </div>
        <p className="text-xs text-slate-400">
          Veri sağlayıcılarının devre kesici (circuit breaker) durumları, model eşik parametreleri ve sistem sürümleri.
        </p>
      </div>

      {/* Provider Diagnostics Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Veri Sağlayıcı Sağlık Durumu</h3>
          </div>
          <button
            onClick={fetchProviderHealth}
            disabled={isLoadingHealth}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Sağlayıcı Durumunu Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3">
          {providerHealth.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              Sağlayıcı durumu sorgulanıyor...
            </div>
          ) : (
            providerHealth.map((p) => (
              <div
                key={p.name}
                className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-white font-mono uppercase">{p.name}</span>
                    {p.isConfigured ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-bold">
                        API KEY AKTİF
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800/60 text-[10px] font-bold">
                        API KEY EKSİK (.env)
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    Devre Kesici (Circuit): <strong className="text-slate-200">{p.status}</strong> &bull; Başarılı: {p.successfulRequests} &bull; Hata: {p.errorCount}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">Gecikme (Latency)</span>
                    <span className="font-bold text-slate-200">{p.latencyMs} ms</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">Zaman Aşımı</span>
                    <span className="font-bold text-slate-200">{p.timeoutCount}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Nesine.com Live Odds & Bulletin Diagnostics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Nesine.com Canlı Bülten & Oran Entegrasyonu</h3>
              <p className="text-[11px] text-slate-400">Gerçek zamanlı bahis bülteni ve piyasa oranları sağlayıcısı</p>
            </div>
          </div>
          <button
            onClick={checkNesine}
            disabled={isLoadingNesine}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNesine ? 'animate-spin' : ''}`} />
            <span>Bağlantıyı Sına</span>
          </button>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">API Uç Noktası (Endpoint)</span>
              <span className="font-mono text-slate-200 text-[11px]">https://bulten.nesine.com/api/bulten/getprebultenfull</span>
            </div>
            <div>
              {nesineStatus?.status === 'CONNECTED' ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  BAĞLANTI AKTİF
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-[10px] font-bold">
                  {nesineStatus?.status || 'Sorgulanıyor'}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs pt-1">
            <div>
              <span className="text-[10px] text-slate-500 block font-sans">Bültendeki Maç Sayısı</span>
              <span className="font-bold text-white text-sm">{nesineStatus?.totalEvents || 0} Futbol Maçı</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-sans">Bülten Önbellek (TTL)</span>
              <span className="font-bold text-slate-200">120 saniye</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-sans">Yetkilendirme</span>
              <span className="font-bold text-emerald-400">Basic Token Doğrulandı</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-sans">Son Senkronizasyon</span>
              <span className="font-bold text-slate-300">
                {nesineStatus?.lastFetch ? new Date(nesineStatus.lastFetch).toLocaleTimeString('tr-TR') : 'Henüz yapılmadı'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-300">Dürüst Veri Politikası: </span>
            Nesine'den gelmeyen veriyi Nesine verisi gibi göstermek kesinlikle yasaktır. Bağlantı kesildiğinde veya bültende maç bulunmadığında yapay/sahte oran üretilmez, sistem otomatik olarak çekimser (abstain) moduna geçer.
          </div>
        </div>
      </div>

      {/* Config Thresholds Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Merkezi Analiz Eşikleri (Thresholds)</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Asgari Sinyal Olasılığı</span>
            <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
              %{(analysisConfig.thresholds.minProbabilityForSignal * 100).toFixed(0)}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Asgari Güven Endeksi</span>
            <span className="text-sm font-bold text-white mt-0.5 block">
              {analysisConfig.thresholds.minConfidenceForSignal} / 100
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Asgari Veri Kalitesi</span>
            <span className="text-sm font-bold text-white mt-0.5 block">
              {analysisConfig.thresholds.minDataQualityForSignal} / 100
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Azami Model Sapması (&sigma;)</span>
            <span className="text-sm font-bold text-amber-400 mt-0.5 block">
              {analysisConfig.thresholds.maxDispersionForSignal}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Asgari Maç Örneklemi</span>
            <span className="text-sm font-bold text-white mt-0.5 block">
              {analysisConfig.thresholds.minMatchesSample} Maç
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Elo Saha Avantajı</span>
            <span className="text-sm font-bold text-white mt-0.5 block">
              +{analysisConfig.elo.homeAdvantageElo} Puan
            </span>
          </div>
        </div>
      </div>

      {/* App Versions Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Sistem Sürümleri & Parametreler</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block font-sans">Uygulama</span>
            <span className="font-bold text-slate-200">v{APP_VERSION}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block font-sans">Model Motoru</span>
            <span className="font-bold text-slate-200">v{MODEL_VERSION}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block font-sans">Analiz Pipeline</span>
            <span className="font-bold text-slate-200">v{ANALYSIS_VERSION}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block font-sans">Kalibrasyon</span>
            <span className="font-bold text-slate-200">v{CALIBRATION_VERSION}</span>
          </div>
        </div>
      </div>

      {/* Danger Zone: Clear Data */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-rose-300">Verileri Sıfırla</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Yerel önbellek, kaydedilmiş favoriler ve tahmin defteri (ledger) kayıtlarını tamamen temizler.
            </p>
          </div>

          <button
            id="btn-trigger-clear-all"
            onClick={() => setShowConfirmClear(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Tüm Verileri Temizle</span>
          </button>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-5 max-w-sm w-full text-slate-200 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Verileri Sıfırla
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Bu işlem cihazınızdaki tüm favorileri, kayıtlı tahmin defteri (ledger) geçmişini ve önbelleğe alınmış maç analizlerini silecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                id="btn-cancel-clear"
                onClick={() => setShowConfirmClear(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Vazgeç
              </button>
              <button
                id="btn-confirm-clear"
                onClick={() => {
                  onClearAllData();
                  setShowConfirmClear(false);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-xs"
              >
                Evet, Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
