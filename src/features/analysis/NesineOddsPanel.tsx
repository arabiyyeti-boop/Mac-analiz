// src/features/analysis/NesineOddsPanel.tsx - Real Nesine Bulletin, Odds Markets, Overround & Movement Panel
import React, { useEffect, useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Minus,
  AlertCircle,
  Percent,
  Layers,
  ArrowRightLeft,
  Sparkles,
  RefreshCw,
  Clock,
  Tag,
} from 'lucide-react';
import { MatchAnalysis, NesineMatchOddsData } from '@/types';
import { AppApiService } from '@/services/api';

interface NesineOddsPanelProps {
  analysis: MatchAnalysis;
}

export const NesineOddsPanel: React.FC<NesineOddsPanelProps> = ({ analysis }) => {
  const [oddsData, setOddsData] = useState<NesineMatchOddsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOdds = async () => {
    setIsLoading(true);
    try {
      const modelProbs = {
        home: analysis.models.dixonColes?.pHome || analysis.models.poisson?.pHome,
        draw: analysis.models.dixonColes?.pDraw || analysis.models.poisson?.pDraw,
        away: analysis.models.dixonColes?.pAway || analysis.models.poisson?.pAway,
        over25: analysis.models.poisson?.pOver25,
        btts: analysis.models.poisson?.pBtts,
      };

      const res = await AppApiService.getNesineOdds(
        analysis.match.id,
        analysis.match.homeTeam.name,
        analysis.match.awayTeam.name,
        modelProbs
      );
      setOddsData(res);
    } catch {
      // Error handled by status in state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOdds();
  }, [analysis.match.id]);

  return (
    <div className="space-y-4">
      {/* Top Banner & Status */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-white">Nesine.com Canlı Oran Verisi</h4>
              {oddsData?.status === 'CONNECTED' && oddsData.markets.length > 0 ? (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Aktif Bağlantı
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Nesine Çekimser Mod
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {oddsData?.nesineEventCode ? `Bülten Kodu: #${oddsData.nesineEventCode} &bull; ` : ''}
              {oddsData?.retrievedAt
                ? `Son Güncelleme: ${new Date(oddsData.retrievedAt).toLocaleTimeString('tr-TR')}`
                : 'Piyasa verisi'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchOdds}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Oranları Yenile</span>
        </button>
      </div>

      {/* Unavailable State Notice */}
      {(!oddsData || oddsData.status !== 'CONNECTED' || oddsData.markets.length === 0) && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Nesine Oran Verisi Bulunamadı / Çekimser Durum</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {oddsData?.diagnosticMessage ||
              'Bu karşılaşma için Nesine bülteninde henüz aktif bahis marketi açılmamış olabilir veya bültene erişim sağlanamadı. Güvenlik ve veri dürüstlüğü kuralı gereği sahte oran üretilmemektedir.'}
          </p>
          <div className="text-[10px] text-slate-400 font-mono">
            İstatistiksel ve olasılıksal modeller (Poisson, Dixon-Coles, Elo) oran verisi olmadan da tam doğrulukla çalışmaya devam etmektedir.
          </div>
        </div>
      )}

      {/* When Odds are Available */}
      {oddsData && oddsData.status === 'CONNECTED' && oddsData.markets.length > 0 && (
        <>
          {/* Overround & De-vigged Fair Probability Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Match Result Overround */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-300">Maç Sonucu Marjı</span>
                <span className="font-mono font-black text-amber-400">
                  %{oddsData.snapshot.overround.matchResult || 0}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>1 (Ev) Fair Prob:</span>
                  <span className="font-mono text-slate-200">
                    %{((oddsData.snapshot.fairProbabilities.homeWin || 0) * 100).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>X (Beraberlik) Fair:</span>
                  <span className="font-mono text-slate-200">
                    %{((oddsData.snapshot.fairProbabilities.draw || 0) * 100).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>2 (Dep) Fair Prob:</span>
                  <span className="font-mono text-slate-200">
                    %{((oddsData.snapshot.fairProbabilities.awayWin || 0) * 100).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2.5 Over/Under Overround */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-300">2.5 Gol Alt/Üst Marjı</span>
                <span className="font-mono font-black text-amber-400">
                  %{oddsData.snapshot.overround.overUnder25 || 0}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>2.5 Alt Fair Prob:</span>
                  <span className="font-mono text-slate-200">
                    %{((oddsData.snapshot.fairProbabilities.under25 || 0) * 100).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>2.5 Üst Fair Prob:</span>
                  <span className="font-mono text-slate-200">
                    %{((oddsData.snapshot.fairProbabilities.over25 || 0) * 100).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* BTTS Overround */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-300">KG Var/Yok Marjı</span>
                <span className="font-mono font-black text-amber-400">
                  %{oddsData.snapshot.overround.btts || 0}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>KG Var Fair Prob:</span>
                  <span className="font-mono text-slate-200">
                    %{((oddsData.snapshot.fairProbabilities.bttsYes || 0) * 100).toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>KG Yok Fair Prob:</span>
                  <span className="font-mono text-slate-200">
                    %{((oddsData.snapshot.fairProbabilities.bttsNo || 0) * 100).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Markets & Outcomes Display */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nesine Bahis Marketleri & Güncel Oranlar</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {oddsData.markets.map((market) => (
                <div key={market.marketId} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                    <span>{market.marketName}</span>
                    {market.overround > 0 && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Marj: %{market.overround}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {market.outcomes.map((outcome) => (
                      <div
                        key={outcome.id}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center"
                      >
                        <span className="text-[11px] text-slate-400 block font-medium truncate">
                          {outcome.name}
                        </span>
                        <span className="text-sm font-mono font-black text-amber-400 block">
                          {outcome.oddFormatted}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Odds Movement & History Section */}
          {oddsData.history && oddsData.history.movements.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                  <span>Oran Değişimleri (Açılış vs Güncel Hareket)</span>
                </h4>
                <span className="text-[10px] text-slate-400">
                  {oddsData.history.snapshots.length} Anlık Görüntü
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {oddsData.history.movements.map((move) => (
                  <div
                    key={move.selection}
                    className={`p-3 rounded-xl border transition-all ${
                      move.isSignificant
                        ? 'bg-amber-950/15 border-amber-600/40'
                        : 'bg-slate-950/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-200">{move.selection}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                          move.direction === 'DOWN'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : move.direction === 'UP'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {move.direction === 'DOWN' && <TrendingDown className="w-3 h-3" />}
                        {move.direction === 'UP' && <TrendingUp className="w-3 h-3" />}
                        {move.direction === 'STABLE' && <Minus className="w-3 h-3" />}
                        <span>%{Math.abs(move.percentChange)}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500 line-through">{move.openingOdd.toFixed(2)}</span>
                      <span className="text-slate-400 text-[11px]">&rarr;</span>
                      <span className="text-white font-bold">{move.currentOdd.toFixed(2)}</span>
                    </div>

                    {move.isSignificant && (
                      <div className="mt-2 text-[10px] text-amber-300/90 font-medium">
                        Önemli Oran Hareketi (&ge; %5 değişim)
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-300">Bilgilendirme: </span>
                Oran düşüşleri (steaming) veya yükselişleri (drift), piyasadaki para akışı ve son dakika kadro haberlerini yansıtır; kesin bir maç sonucu garantisi teşkil etmez.
              </div>
            </div>
          )}

          {/* Probability Edge / Mathematical Value */}
          {oddsData.edges && oddsData.edges.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>İstatistiksel Olasılık Avantajı (Model vs Nesine Fair Prob)</span>
              </h4>

              <div className="space-y-2">
                {oddsData.edges.map((edge) => (
                  <div
                    key={edge.selection}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      edge.hasValue
                        ? 'bg-emerald-950/20 border-emerald-700/50'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{edge.selection}</span>
                        <span className="text-[11px] font-mono text-amber-400 font-bold">
                          {edge.bookmakerOdd.toFixed(2)} Oran
                        </span>
                        {edge.hasValue && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            +{edge.edgePercentage}% Avantaj
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Model Olasılığı: %{(edge.modelProbability * 100).toFixed(1)} &bull; Nesine Fair Prob: %{(edge.fairImpliedProbability * 100).toFixed(1)}
                      </div>
                    </div>

                    <div className="text-right sm:shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 block">Güven Katsayısı</span>
                      <span className="text-xs font-black font-mono text-slate-200">
                        {edge.confidenceScore}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-slate-500 italic">
                * Oran avantajı (edge), model tahmininin piyasa beklentisine kıyasla istatistiksel farkını ifade eder. Varyans ve maç dinamikleri sebebiyle hiçbir seçim kesin kazanç vadetmez.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
