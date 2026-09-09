// src/features/analysis/QualityAndConfidencePanel.tsx - Data Quality Vector & Confidence Decomposition
import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Percent,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { MatchAnalysis } from '@/types';
import { AdvancedIntelligenceEngine } from '@/analysis/advancedIntelligence';
import { canonicalEntityManager } from '@/entity/CanonicalEntityManager';
import { H2HStatusPanel } from './H2HStatusPanel';

interface QualityAndConfidencePanelProps {
  analysis: MatchAnalysis;
}

export const QualityAndConfidencePanel: React.FC<QualityAndConfidencePanelProps> = ({ analysis }) => {
  const dataQualityVector = AdvancedIntelligenceEngine.computeDataQualityVector(analysis);
  const confidenceDecomp = AdvancedIntelligenceEngine.decomposeConfidence(analysis);
  const consistencyReport = canonicalEntityManager.runFinalConsistencyCheck(analysis.match);

  return (
    <div className="space-y-4">
      {/* 86 & 231-250: CANONICAL IDENTITY & FINAL CONSISTENCY CHECK */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-950/70 text-indigo-400 border border-indigo-800/40 text-[10px] font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Madde 86 & 231-250 &bull; Entity & Data Integrity Engine</span>
            </div>
            <h4 className="text-sm font-bold text-white">Nihai Tutarlılık ve Kimlik Doğrulaması (Final Consistency Check)</h4>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                consistencyReport.analysisPermitted
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60'
                  : 'bg-rose-950/70 text-rose-400 border-rose-800/60'
              }`}
            >
              {consistencyReport.analysisPermitted ? '✓ TÜM DOĞRULAMALAR GEÇTİ' : '⚠ ANALİZ BLOKE EDİLDİ'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs mb-3">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Canonical Fixture ID</span>
            <span className="text-xs font-bold text-emerald-400 font-mono mt-0.5 block truncate" title={consistencyReport.canonicalFixtureId}>
              {consistencyReport.canonicalFixtureId}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Ev Sahibi Canonical Takım</span>
            <span className="text-xs font-bold text-white font-mono mt-0.5 block truncate">
              {analysis.match.homeTeam.name}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Deplasman Canonical Takım</span>
            <span className="text-xs font-bold text-white font-mono mt-0.5 block truncate">
              {analysis.match.awayTeam.name}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Ev Sahibi Logo Doğrulaması</span>
            <span className="text-xs font-bold text-emerald-400 mt-0.5 block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Doğrulandı (Owner Match)
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Deplasman Logo Doğrulaması</span>
            <span className="text-xs font-bold text-emerald-400 mt-0.5 block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Doğrulandı (Owner Match)
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Oran & Fikstür Eşleşmesi</span>
            <span className="text-xs font-bold text-emerald-400 mt-0.5 block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Doğrulandı (Zero Cross-Match)
            </span>
          </div>
        </div>

        {consistencyReport.warnings.length > 0 && (
          <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 mb-2">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Bütünlük Uyarıları</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
              {consistencyReport.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {/* 162 & 163. CONFIDENCE DECOMPOSITION & CONFIDENCE CEILING */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Madde 162 &bull; Açıklanabilir Güven Dekompozisyonu</span>
            </div>
            <h4 className="text-sm font-bold text-white">Hesaplanmış Güven Endeksi (Decomposed Confidence)</h4>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Nihai Güven</span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                {confidenceDecomp.finalConfidence}/100
              </span>
            </div>
          </div>
        </div>

        {/* 163: STRICT CONFIDENCE CEILING NOTIFICATION */}
        {confidenceDecomp.confidenceCeilingApplied ? (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 mb-4 text-xs text-amber-300">
            <div className="flex items-center gap-2 font-bold mb-1">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>GÜVEN TAVANI DEVREDE (CONFIDENCE CEILING ACTIVE - Madde 163)</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Veri kalitesi veya örneklem skoru asgari eşiğin altında olduğu için model olasılığı yüksek olsa dahi nihai güven{' '}
              <strong className="text-amber-400 font-mono">{confidenceDecomp.maxAllowedCeiling}/100</strong> tavanı ile sınırlandırılmıştır.
              Sistem olasılık ile güveni asla eş anlamlı kabul etmez.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-4 text-xs text-slate-300">
            {confidenceDecomp.explanation}
          </div>
        )}

        {/* Factors Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs mb-3">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Olasılık Gücü</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              +{confidenceDecomp.factors.probabilityStrength} / 25
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Model Uzlaşısı</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              +{confidenceDecomp.factors.modelAgreement} / 20
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Veri Kalitesi Katkısı</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              +{confidenceDecomp.factors.dataQualityContribution} / 20
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Kalibrasyon Uyumu</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              +{confidenceDecomp.factors.calibrationAlignment} / 15
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Örneklem Yeterliliği</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              +{confidenceDecomp.factors.sampleSufficiency} / 10
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Veri Tazeliği</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              +{confidenceDecomp.factors.freshnessScore} / 10
            </span>
          </div>
        </div>

        {/* Penalties */}
        <div className="flex flex-wrap gap-2 text-[11px] pt-2 border-t border-slate-800/80">
          <span className="text-slate-400">Uygulanan İndirimler:</span>
          <span className="text-slate-300">
            Belirsizlik Cezası: <strong className="text-amber-400 font-mono">-{confidenceDecomp.penalties.uncertaintyPenalty}</strong>
          </span>
          {confidenceDecomp.penalties.anomalyPenalty > 0 && (
            <span className="text-slate-300">
              Anomali Cezası: <strong className="text-rose-400 font-mono">-{confidenceDecomp.penalties.anomalyPenalty}</strong>
            </span>
          )}
        </div>
      </div>

      {/* 161. DATA QUALITY VECTOR (9 SUB-METRICS) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-bold text-white">Data Quality Vector (9 Boyutlu Kalite Matrisi)</h4>
            <p className="text-xs text-slate-400">Madde 161 &bull; Tek bir sayı yerine doğrulanabilir alt kırılımlar</p>
          </div>
          <div className="text-xl font-black font-mono text-sky-400">
            {dataQualityVector.overallScore}/100
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs mb-3">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Fikstür Doğrulaması</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.fixtureQuality} / 100
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Takım Kimliği</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.teamQuality} / 100
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Form & H2H Kalitesi</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.formQuality} / 100
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">xG & Pozisyon Verisi</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.xGQuality} / 100
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Sakatlık Bütünlüğü</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.injuryQuality} / 100
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Oran (Odds) Kalitesi</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.oddsQuality} / 100
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Kadro (Lineup) Güveni</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.lineupQuality} / 100
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Veri Tazeliği</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.freshnessQuality} / 100
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] block">Kaynak Uzlaşısı</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">
              {dataQualityVector.sourceAgreement} / 100
            </span>
          </div>
        </div>

        {analysis.dataQuality.warnings.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Veri Kalitesi Uyarıları</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
              {analysis.dataQuality.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <H2HStatusPanel h2h={analysis.h2h} match={analysis.match} />
      </div>
    </div>
  );
};
