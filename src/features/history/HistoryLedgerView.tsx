// src/features/history/HistoryLedgerView.tsx - Immutable Prediction Ledger & Walk-Forward Backtest
import React, { useState, useEffect } from 'react';
import {
  History,
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
  BarChart3,
  Sliders,
  Trash2,
} from 'lucide-react';
import { PredictionRecord, BacktestResult } from '@/types';
import { predictionLedger } from '@/prediction/ledger';
import { BacktestEngine } from '@/backtest/engine';

export const HistoryLedgerView: React.FC = () => {
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'CALIBRATION' | 'DRIFT'>('LEDGER');
  const [evalHomeScore, setEvalHomeScore] = useState<Record<string, number>>({});
  const [evalAwayScore, setEvalAwayScore] = useState<Record<string, number>>({});

  const loadLedger = async () => {
    const list = await predictionLedger.getAllRecords();
    setRecords(list);
    const bt = BacktestEngine.runBacktest(list);
    setBacktest(bt);
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const handleEvaluate = async (predictionId: string) => {
    const h = evalHomeScore[predictionId] ?? 2;
    const a = evalAwayScore[predictionId] ?? 1;
    await predictionLedger.evaluatePrediction(predictionId, h, a);
    await loadLedger();
  };

  const handleClearLedger = async () => {
    if (window.confirm('Ledger geçmişindeki tüm tahmin kayıtlarını silmek istediğinize emin misiniz?')) {
      await predictionLedger.clearLedger();
      await loadLedger();
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header & Metric Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 text-[11px] font-semibold mb-2">
              <History className="w-3.5 h-3.5" />
              <span>Değiştirilemez Prediction Ledger</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Tahmin Kayıt Defteri & Backtest</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Model tahminleri oluşturulduğu anda dondurulur (immutable). Maç bittiğinde gerçek skorla eşleştirilerek Brier hata skoru ve kalibrasyon eğrisi hesaplanır.
            </p>
          </div>

          {records.length > 0 && (
            <button
              onClick={handleClearLedger}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 text-xs font-semibold border border-slate-700/60 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Ledger'ı Temizle</span>
            </button>
          )}
        </div>

        {/* Backtest Overview Metrics */}
        {backtest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 font-medium">Toplam Kayıt</span>
              <div className="text-xl font-extrabold text-white mt-0.5">{backtest.totalPredictions}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 font-medium">Sonuçlanan / İsabet</span>
              <div className="text-xl font-extrabold text-emerald-400 mt-0.5">
                {backtest.wonPredictions} / {backtest.evaluatedPredictions} (%{backtest.hitRate})
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 font-medium">Ortalama Brier Skoru</span>
              <div className="text-xl font-extrabold text-sky-400 font-mono mt-0.5">
                {backtest.averageBrierScore.toFixed(4)}
              </div>
              <span className="text-[9px] text-slate-500">0.00 = mükemmel</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 font-medium">Model Drift Durumu</span>
              <div className="mt-0.5">
                {backtest.driftDetected ? (
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>SAPMA TESPİT EDİLDİ</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>STABİL & KALİBRE</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'LEDGER'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Kayıt Defteri ({records.length})
        </button>
        <button
          onClick={() => setActiveTab('CALIBRATION')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'CALIBRATION'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Kalibrasyon Eğrisi
        </button>
        <button
          onClick={() => setActiveTab('DRIFT')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'DRIFT'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          Champion vs Challenger
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* SUBTAB 1: LEDGER RECORDS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center">
              <History className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white">Henüz Tahmin Kaydedilmedi</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                "Genel Bakış" veya "Derin Analiz" ekranında filtreyi geçen sinyallerin yanındaki <strong>"Ledger'a Yaz"</strong> butonuna basarak değişmez kayıt oluşturabilirsiniz.
              </p>
            </div>
          ) : (
            records.map((rec) => {
              const isEvaluated = rec.actualOutcome !== undefined;

              return (
                <div
                  key={rec.predictionId}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">{rec.league}</span>
                      <span className="text-xs text-slate-500">&bull;</span>
                      <span className="text-xs font-bold text-white">
                        {rec.homeTeam} vs {rec.awayTeam}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(rec.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold">
                        {rec.market}: {rec.selection}
                      </span>
                    </div>
                  </div>

                  {/* Prediction stats snapshot */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/60 p-2.5 rounded-xl text-xs border border-slate-800/50 mb-3 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Model Olasılığı</span>
                      <span className="font-extrabold text-emerald-400">
                        %{(rec.modelProbability * 100).toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Güven Endeksi</span>
                      <span className="font-extrabold text-white">
                        {rec.confidence} / 100
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Veri Kalitesi</span>
                      <span className="font-extrabold text-slate-300">
                        {rec.dataQuality} / 100
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Durum</span>
                      <span className="font-extrabold text-sky-400 font-sans">
                        {rec.signalState}
                      </span>
                    </div>
                  </div>

                  {/* Outcome Evaluation */}
                  <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    {isEvaluated ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          {rec.actualOutcome!.outcomeWon ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                          <span className={`font-bold ${rec.actualOutcome!.outcomeWon ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {rec.actualOutcome!.outcomeWon ? 'KAZANDI (WON)' : 'KAYBETTİ (LOST)'}
                          </span>
                        </div>

                        <span className="text-slate-400 font-mono">
                          Skor: {rec.actualOutcome!.fullTimeScore.home} - {rec.actualOutcome!.fullTimeScore.away}
                        </span>

                        <span className="text-slate-400 font-mono text-[11px]">
                          Brier Hatası: <strong>{rec.actualOutcome!.brierError}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-slate-400 text-[11px]">Skor Doğrula:</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          defaultValue={2}
                          onChange={(e) =>
                            setEvalHomeScore((prev) => ({
                              ...prev,
                              [rec.predictionId]: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-12 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-center font-mono text-white text-xs"
                        />
                        <span className="text-slate-500">-</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          defaultValue={1}
                          onChange={(e) =>
                            setEvalAwayScore((prev) => ({
                              ...prev,
                              [rec.predictionId]: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-12 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-center font-mono text-white text-xs"
                        />
                        <button
                          onClick={() => handleEvaluate(rec.predictionId)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                        >
                          Değerlendir
                        </button>
                      </div>
                    )}

                    <span className="text-[10px] text-slate-500 font-mono">
                      ID: {rec.predictionId.substring(0, 20)}... &bull; v{rec.analysisVersion}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SUBTAB 2: CALIBRATION CURVE BINS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'CALIBRATION' && backtest && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Güvenilirlik & Kalibrasyon Eğrisi (Reliability Curve)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Modelin örneğin %60-80 olasılık verdiği maçların gerçekte de %60-80 oranında gerçekleşip gerçekleşmediğini denetler.
            </p>
          </div>

          {backtest.calibrationBins.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Henüz sonuçlandırılmış tahmin verisi bulunmuyor. Ledger sekmesinden maç sonuçlarını girerek kalibrasyonu hesaplayabilirsiniz.
            </div>
          ) : (
            <div className="space-y-3">
              {backtest.calibrationBins.map((bin) => (
                <div key={bin.binRange} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-white font-mono">{bin.binRange} Dilimi</span>
                    <span className="text-slate-400 font-mono text-[11px]">{bin.count} Maç</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono mb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Model Tahmin Ortalaması</span>
                      <span className="text-emerald-400 font-bold">
                        %{(bin.predictedAvg * 100).toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Gerçekleşme Oranı</span>
                      <span className="text-white font-bold">
                        %{(bin.actualAvg * 100).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar comparison */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${bin.actualAvg * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SUBTAB 3: CHAMPION VS CHALLENGER */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'DRIFT' && backtest && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Champion vs Challenger Model Karşılaştırması</h3>
            <p className="text-xs text-slate-400 mt-1">
              Üretimdeki ana ensemble modeli (Champion) ile alternatif ağırlıklandırılmış aday model (Challenger) arasındaki Brier hata farkı.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Champion Model Brier</span>
              <span className="text-lg font-extrabold text-emerald-400 mt-1 block">
                {backtest.championVsChallenger.championBrier.toFixed(4)}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">Üretimdeki Ensemble</span>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Challenger Model Brier</span>
              <span className="text-lg font-extrabold text-sky-400 mt-1 block">
                {backtest.championVsChallenger.challengerBrier.toFixed(4)}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">Simüle Edilen Aday</span>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Sistem Tavsiyesi</span>
              <span className="text-xs font-extrabold text-amber-400 mt-1 block font-sans">
                {backtest.championVsChallenger.recommendation === 'RETAIN_CHAMPION'
                  ? 'CHAMPION KORUNUYOR'
                  : backtest.championVsChallenger.recommendation === 'PROMOTE_CHALLENGER'
                  ? 'CHALLENGER TERFİ ETTİRİLEBİLİR'
                  : 'YETERSİZ ÖRNEKLEM (GÖZLEMLENİYOR)'}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">Asgari 30 maç gerekir</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
