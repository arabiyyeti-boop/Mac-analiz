// src/ai/gemini.ts - AI Explanation Layer & Hallucination Guard
import { GoogleGenAI } from '@google/genai';
import { MatchAnalysis, AIExplanation } from '@/types';

export class AIExplanationService {
  private static client: GoogleGenAI | null = null;
  public static readonly AI_MODEL = 'gemini-3.8-flash';
  public static readonly AI_PROMPT_VERSION = '2.4.0';
  public static readonly AI_SCHEMA_VERSION = '1.2.0';

  private static getClient(): GoogleGenAI | null {
    if (!AIExplanationService.client && process.env.GEMINI_API_KEY) {
      AIExplanationService.client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return AIExplanationService.client;
  }

  /**
   * 174. AI FACT CHECK LAYER
   * Validates generated AI text against deterministic analysis facts
   */
  public static factCheckAIOutput(
    parsed: { summary: string; tacticalContext: string; riskAssessment?: string },
    analysis: MatchAnalysis
  ): { passed: boolean; discrepancies: string[] } {
    const discrepancies: string[] = [];
    const fullText = `${parsed.summary} ${parsed.tacticalContext} ${parsed.riskAssessment || ''}`.toLowerCase();

    // 1. Forbidden promise words
    const forbiddenWords = ['garanti', 'kesin', '%100', 'yüzde yüz', 'banko', 'risksiz', 'şüphesiz kazanır'];
    for (const word of forbiddenWords) {
      if (fullText.includes(word)) {
        discrepancies.push(`Yasaklı kesinlik ifadesi saptandı: "${word}"`);
      }
    }

    // 2. Discrepancy check: Verify primary probability consistency if mentioned
    if (analysis.primarySignal) {
      const probPercent = Math.round(analysis.primarySignal.modelProbability * 100);
      const matches = fullText.match(/%\s?(\d{1,3})/g);
      if (matches) {
        for (const m of matches) {
          const num = parseInt(m.replace(/[^\d]/g, ''), 10);
          if (num > 0 && num <= 100 && Math.abs(num - probPercent) > 25 && num !== Math.round(analysis.dataQuality.score)) {
            // Significant ungrounded percentage discrepancy
            discrepancies.push(`Analiz dışı olasılık oranı tespit edildi: %${num}`);
          }
        }
      }
    }

    return {
      passed: discrepancies.length === 0,
      discrepancies,
    };
  }

  /**
   * Generates deterministic fallback explanation strictly from mathematical output
   */
  public static generateFallbackExplanation(analysis: MatchAnalysis): AIExplanation {
    const home = analysis.match.homeTeam.name;
    const away = analysis.match.awayTeam.name;
    const signal = analysis.primarySignal;

    const summary = signal
      ? `${home} - ${away} mücadelesinde ensemble model, en yüksek istatistiksel tutarlılığı "${signal.marketNameTr}" (${signal.selection}) seçiminde tespit etmiştir. Model olasılığı: %${(signal.modelProbability * 100).toFixed(1)}, hesaplanan güven endeksi: ${signal.confidence}/100.`
      : `${home} - ${away} karşılaşmasında veriler veya model uzlaşısı asgari risk filtrelerini karşılamadığı için sistem çekimser (ABSTAIN / NO SIGNAL) kalmıştır.`;

    const modelAgreementAnalysis = `Poisson, Dixon-Coles, Elo ve Form modelleri arasındaki standart sapma ${(analysis.agreement.MS1.stdDev).toFixed(3)} olarak ölçülmüştür. ${analysis.agreement.MS1.isAgreementHigh ? 'Modeller benzer yönü işaret etmektedir.' : 'Modeller arasında görüş ayrılığı (divergence) mevcuttur.'}`;

    const tacticalContext = `Ev sahibi takımın saha üstünlük katsayısı ${analysis.models.homeAway?.homeAdvantageFactor || 1.2} seviyesindedir. Lig ortalama gol beklentisi ${analysis.models.league?.avgGoals || 2.7} goldür.`;

    const riskAssessment = analysis.dataQuality.warnings.length > 0
      ? `Risk Değerlendirmesi: ${analysis.dataQuality.warnings.join(' ')}`
      : 'Veri kalitesi yüksek, temel istatistiksel parametreler tutarlı.';

    const factorsFor = signal?.reasons || ['Model olasılık dağılımı seçimi destekliyor.'];
    const factorsAgainst = analysis.dataQuality.warnings.concat(signal?.riskFilterFailures || []);

    return {
      summary,
      tacticalContext,
      modelAgreementAnalysis,
      riskAssessment,
      factorsFor,
      factorsAgainst: factorsAgainst.length > 0 ? factorsAgainst : ['Futbolda tek maç varyansı ve beklenmedik kart/sakatlık riskleri her zaman mevcuttur.'],
      generatedAt: new Date().toISOString(),
      disclaimer: 'Bu analiz tamamen matematiksel ve istatistiksel modellemelere dayanır. Asla kesin kazanç veya garanti anlamına gelmez.',
      aiModel: 'Deterministic-Fallback-Engine',
      aiPromptVersion: this.AI_PROMPT_VERSION,
      aiSchemaVersion: this.AI_SCHEMA_VERSION,
      factCheckPassed: true,
      fallbackUsed: true,
    };
  }

  /**
   * Requests contextual explanation from Gemini using strict input contract and hallucination guard
   */
  public static async generateExplanation(analysis: MatchAnalysis): Promise<AIExplanation> {
    const ai = this.getClient();

    // If Gemini client not available, gracefully use fallback
    if (!ai) {
      return this.generateFallbackExplanation(analysis);
    }

    try {
      const promptPayload = {
        match: {
          home: analysis.match.homeTeam.name,
          away: analysis.match.awayTeam.name,
          league: analysis.match.league.name,
          date: analysis.match.utcDate,
        },
        dataQualityScore: analysis.dataQuality.score,
        dataWarnings: analysis.dataQuality.warnings,
        ensembleProbabilities: analysis.ensemble,
        modelAgreement: {
          ms1StdDev: analysis.agreement.MS1.stdDev,
          ms1Range: analysis.agreement.MS1.range,
          isHigh: analysis.agreement.MS1.isAgreementHigh,
        },
        primarySignal: analysis.primarySignal ? {
          market: analysis.primarySignal.market,
          selection: analysis.primarySignal.selection,
          probability: analysis.primarySignal.modelProbability,
          confidence: analysis.primarySignal.confidence,
          state: analysis.primarySignal.signalState,
          reasons: analysis.primarySignal.reasons,
        } : null,
      };

      const systemInstruction = `Sen "MAÇ ANALİZ PRO" istatistiksel analiz asistanısın.
GÖREVİN: Yalnızca sana verilen doğrulanmış matematiksel ve istatistiksel verileri Türkçe, nesnel, teknik ve anlaşılır bir dille yorumlamaktır.
KESİN KURALLAR:
1. Asla "kesin", "garantili", "banko", "%100", "risksiz", "mutlaka kazanır" gibi ifadeler kullanma.
2. Sana iletilmeyen sahte sakatlık, uydurma transfer, sahte oran veya asılsız haberler uydurma (Hallucination Guard).
3. Model olasılıklarını ve yüzdelerini değiştirme; sana verilen sayılara sadık kal.
4. Çıktını yalnızca geçerli bir JSON nesnesi olarak döndür:
{
  "summary": "...",
  "tacticalContext": "...",
  "modelAgreementAnalysis": "...",
  "riskAssessment": "...",
  "factorsFor": ["...", "..."],
  "factorsAgainst": ["...", "..."]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Aşağıdaki doğrulanmış matematiksel maç analizi için nesnel uzman yorumunu JSON formatında üret:\n${JSON.stringify(promptPayload, null, 2)}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const text = response.text?.trim();
      if (!text) {
        return this.generateFallbackExplanation(analysis);
      }

      const parsed = JSON.parse(text);

      // Hallucination & Schema Guard
      if (
        typeof parsed.summary !== 'string' ||
        typeof parsed.tacticalContext !== 'string' ||
        !Array.isArray(parsed.factorsFor) ||
        !Array.isArray(parsed.factorsAgainst)
      ) {
        return this.generateFallbackExplanation(analysis);
      }

      // 174. Run Deterministic AI Fact Check Layer
      const factCheck = this.factCheckAIOutput(parsed, analysis);
      if (!factCheck.passed) {
        // Fallback to pure deterministic mathematical explanation if hallucination or forbidden phrasing detected
        return this.generateFallbackExplanation(analysis);
      }

      return {
        summary: parsed.summary,
        tacticalContext: parsed.tacticalContext,
        modelAgreementAnalysis: parsed.modelAgreementAnalysis || 'Modeller arası uzlaşı değerlendirilmiştir.',
        riskAssessment: parsed.riskAssessment || 'İstatistiksel varyans ve dış etkenler göz önünde bulundurulmalıdır.',
        factorsFor: parsed.factorsFor.slice(0, 4),
        factorsAgainst: parsed.factorsAgainst.slice(0, 4),
        generatedAt: new Date().toISOString(),
        disclaimer: 'Model olasılıkları matematiksel simülasyon çıktısıdır. Futbol müsabakaları sonuç garantisi barındırmaz.',
        aiModel: this.AI_MODEL,
        aiPromptVersion: this.AI_PROMPT_VERSION,
        aiSchemaVersion: this.AI_SCHEMA_VERSION,
        factCheckPassed: true,
        fallbackUsed: false,
      };
    } catch {
      // If Gemini call fails, return fallback mathematical explanation
      return this.generateFallbackExplanation(analysis);
    }
  }
}
