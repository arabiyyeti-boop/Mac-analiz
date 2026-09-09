import React from 'react';
import { CanonicalH2H, CanonicalMatch } from '@/types';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, History, ShieldCheck } from 'lucide-react';

interface H2HStatusPanelProps {
  h2h?: CanonicalH2H;
  match: CanonicalMatch;
}

export const H2HStatusPanel: React.FC<H2HStatusPanelProps> = ({ h2h, match }) => {
  const status = h2h?.status || (h2h && h2h.matchesCount > 0 ? 'AVAILABLE' : 'MISSING');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">İkili Karşılaşma (H2H) Analizi</h4>
            <p className="text-[10px] text-slate-400">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {status === 'AVAILABLE' && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-bold">
              <CheckCircle2 className="w-3 h-3" />
              <span>DOĞRULANMIŞ H2H</span>
            </span>
          )}
          {status === 'MISSING' && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
              <Info className="w-3 h-3 text-slate-400" />
              <span>H2H MEVCUT DEĞİL</span>
            </span>
          )}
          {status === 'LOW_CONFIDENCE' && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 font-bold">
              <AlertTriangle className="w-3 h-3" />
              <span>DÜŞÜK GÜVEN</span>
            </span>
          )}
          {status === 'CONFLICTING' && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/60 font-bold">
              <AlertOctagon className="w-3 h-3" />
              <span>ÇELİŞKİLİ VERİ</span>
            </span>
          )}
        </div>
      </div>

      {/* Case 1: MISSING */}
      {status === 'MISSING' && (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 text-slate-400">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white mb-1">
              Bu karşılaşma için doğrulanmış H2H verisi mevcut değil.
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Veri sağlayıcılarında iki takım arasında doğrulanmış ikili rekabet kaydı bulunmuyor veya bu lig/karşılaşma için harici H2H sağlayıcısı aktif değil. Analiz motoru form ve lig temel verilerine göre çalışmaktadır.
            </p>
          </div>
        </div>
      )}

      {/* Case 2: LOW_CONFIDENCE */}
      {status === 'LOW_CONFIDENCE' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-amber-300 mb-1">
                Düşük Güvenilirlikli H2H Verisi
              </div>
              <p className="text-amber-200/80 text-[11px] leading-relaxed">
                Takım isim eşleşmesi veya veri sağlayıcı eşleştirmesi kısıtlı güvenilirlikle sağlandı. Bu veriler analize minimum ağırlıkla dahil edilmektedir.
              </p>
            </div>
          </div>

          {h2h && h2h.recentMatches && h2h.recentMatches.length > 0 && (
            <div className="mt-2 divide-y divide-slate-800/60 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
              {h2h.recentMatches.map((m, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500 font-mono">{m.date ? new Date(m.date).toLocaleDateString('tr-TR') : '-'}</span>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-slate-300">{m.homeTeam}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono font-bold">
                      {m.homeScore} - {m.awayScore}
                    </span>
                    <span className="text-slate-300">{m.awayTeam}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Case 3: CONFLICTING */}
      {status === 'CONFLICTING' && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-xs text-rose-200 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-900/50 flex items-center justify-center shrink-0 mt-0.5 text-rose-400">
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-rose-300 mb-1">
              Çelişkili H2H Verisi Tespit Edildi
            </div>
            <p className="text-rose-200/80 text-[11px] leading-relaxed">
              Farklı veri sağlayıcıları arasında ikili mücadele istatistikleri ve maç sonuçlarında uyuşmazlık saptandı. Yanıltıcı sinyalleri önlemek için H2H ağırlığı sıfırlanmıştır.
            </p>
          </div>
        </div>
      )}

      {/* Case 4: AVAILABLE */}
      {status === 'AVAILABLE' && h2h && (
        <div className="space-y-4">
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Toplam Maç</span>
              <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                {h2h.matchesCount}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{match.homeTeam.name}</span>
              <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
                {h2h.homeWins} G
              </span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Beraberlik</span>
              <span className="text-sm font-bold text-slate-200 font-mono mt-0.5 block">
                {h2h.draws} B
              </span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{match.awayTeam.name}</span>
              <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">
                {h2h.awayWins} G
              </span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 block">Maç Başı Gol</span>
              <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
                {h2h.avgGoals.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Recent Matches List */}
          {h2h.recentMatches && h2h.recentMatches.length > 0 && (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
              <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-300">Geçmiş Karşılaşmalar</span>
                <span className="text-slate-500 font-mono">Son {h2h.recentMatches.length} Maç</span>
              </div>
              <div className="divide-y divide-slate-800/60">
                {h2h.recentMatches.map((m, idx) => (
                  <div key={idx} className="px-3 py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40 transition-colors">
                    <span className="text-[10px] text-slate-400 font-mono w-20">
                      {m.date ? new Date(m.date).toLocaleDateString('tr-TR') : '-'}
                    </span>
                    <div className="flex-1 flex items-center justify-center gap-3">
                      <span className={`text-right flex-1 truncate ${m.homeScore > m.awayScore ? 'font-bold text-emerald-400' : 'text-slate-300'}`}>
                        {m.homeTeam}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono font-bold shrink-0 text-xs border border-slate-700">
                        {m.homeScore} - {m.awayScore}
                      </span>
                      <span className={`text-left flex-1 truncate ${m.awayScore > m.homeScore ? 'font-bold text-emerald-400' : 'text-slate-300'}`}>
                        {m.awayTeam}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provider Provenance Footer */}
          {h2h.source && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Doğrulanmış Kaynak: {h2h.source}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
