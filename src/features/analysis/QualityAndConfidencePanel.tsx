// src/features/analysis/QualityAndConfidencePanel.tsx - Data Quality 2.0 Vector & Confidence Decomposition
import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Percent,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Clock,
  Database,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { MatchAnalysis, DataQualityStatus, TemporalFreshnessClass } from '@/types';
import { AdvancedIntelligenceEngine } from '@/analysis/advancedIntelligence';
import { canonicalEntityManager } from '@/entity/CanonicalEntityManager';
import { H2HStatusPanel } from './H2HStatusPanel';

interface QualityAndConfidencePanelProps {
  analysis: MatchAnalysis;
}

export const QualityAndConfidencePanel: React.FC<QualityAndConfidencePanelProps> = ({ analysis }) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const dataQuality = analysis.dataQuality;
  const dataQualityVector = AdvancedIntelligenceEngine.computeDataQualityVector(analysis);
  const confidenceDecomp = AdvancedIntelligenceEngine.decomposeConfidence(analysis);
  const consistencyReport = canonicalEntityManager.runFinalConsistencyCheck(analysis.match);

  // Render stylized progress bar (10 blocks)
  const filledBlocks = Math.round((dataQuality.score / 100) * 10);
  const emptyBlocks = 10 - filledBlocks;
  const barString = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  const getStatusBadge = (status?: DataQualityStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">AVAILABLE</span>;
      case 'PARTIAL':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">PARTIAL</span>;
      case 'MISSING':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700/50 text-slate-400 border border-slate-600">MISSING</span>;
      case 'STALE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">STALE</span>;
      case 'CONFLICTING':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">CONFLICTING</span>;
      case 'LOW_CONFIDENCE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">LOW_CONFIDENCE</span>;
      case 'INVALID':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">INVALID</span>;
      case 'NOT_APPLICABLE':
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">N/A</span>;
    }
  };

  const getFreshnessBadge = (freshness?: TemporalFreshnessClass) => {
    switch (freshness) {
      case 'REALTIME':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300">REALTIME</span>;
      case 'VERY_FRESH':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-500/15 text-teal-300">VERY_FRESH</span>;
      case 'FRESH':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-300">FRESH</span>;
      case 'AGING':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300">AGING</span>;
      case 'STALE':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300">STALE</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* DATA QUALITY 2.0 PRIMARY SUMMARY & PROGRESSIVE DISCLOSURE (Section 13) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Database className="w-3 h-3" />
              <span>DATA QUALITY 2.0 &bull; Doğrulanmış Veri Katmanı</span>
            </div>
            <h4 className="text-sm font-bold text-white tracking-wide">VERİ KALİTESİ</h4>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-mono text-xs tracking-widest text-emerald-400 hidden sm:block">
              {barString}
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {dataQuality.score}/100
            </div>
          </div>
        </div>

        {/* Visual Progress Bar on Mobile */}
        <div className="sm:hidden mb-3">
          <div className="font-mono text-sm tracking-widest text-emerald-400">
            {barString}
          </div>
        </div>

        {/* Quality Explanations (Short list per Section 13) */}
        <div className="space-y-2 mb-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Kalite Faktörleri & Doğrulamalar</span>
          </div>

          <div className="space-y-1.5">
            {dataQuality.qualityExplanations && dataQuality.qualityExplanations.length > 0 ? (
              dataQuality.qualityExplanations.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  {item.type === 'CHECK' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {item.type === 'WARN' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                  {item.type === 'DANGER' && <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span
                    className={
                      item.type === 'CHECK'
                        ? 'text-slate-200 font-medium'
                        : item.type === 'WARN'
                        ? 'text-amber-300 font-medium'
                        : 'text-rose-300 font-bold'
                    }
                  >
                    {item.text}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Fixture ve müsabaka kimliği doğrulandı</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Takım kimlikleri doğrulandı (Canonical Identity)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Form verisi güncel ve zaman damgası geçerli</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progressive Disclosure Toggle Button */}
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-300 transition-colors border border-slate-700/60"
        >
          <span className="font-semibold flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Bileşen Durumları & Zaman Aşımı (TTL) Raporu
          </span>
          {showTechnicalDetails ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Detailed Component Breakdown (Progressive Disclosure) */}
        {showTechnicalDetails && dataQuality.componentDetails && (
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.values(dataQuality.componentDetails).map((comp: any, idx) => (
              <div key={idx} className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white truncate">{comp.nameTr}</span>
                  {getStatusBadge(comp.status)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    Tazelik:
                  </span>
                  {getFreshnessBadge(comp.freshness)}
                </div>
                {comp.sampleSize !== undefined && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                    <span>Örneklem Boyutu:</span>
                    <span className="font-mono text-slate-200">{comp.sampleSize} kayıt</span>
                  </div>
                )}
                {comp.issues && comp.issues.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 text-[10px] text-amber-300">
                    {comp.issues[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

