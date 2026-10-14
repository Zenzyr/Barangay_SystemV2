import { AnalyticsSummary } from "../../types/analytics.type";
import { AIInsightResult, AIProviderName } from "../../types/ai.type";
import { getAIProvider, getAIProviderName } from "./aiProviders";
import { RuleBasedAIProvider } from "./ruleBasedAIProvider";
import { SCORING_VERSION } from "../../utils/analyticsRules";

/**
 * AIInsightService — the single entry point the rest of the app uses to get
 * AI-driven decision support. It reads analytics from the AnalyticsSummary it
 * is given (never queries the database itself) and delegates to whichever
 * provider is selected by the AI_PROVIDER env flag.
 *
 * A real LLM provider (gemini) failing — timeout, rate limit, bad key, invalid
 * response — never loses the analysis: the call degrades gracefully to the
 * deterministic rule-based provider, and the caller is told via `notice` that
 * a fallback result is being shown. Swapping providers remains a config change,
 * not a code change, everywhere outside of services/ai/.
 */
export class AIInsightService {
  static async generateInsights(analyticsData: AnalyticsSummary): Promise<AIInsightResult> {
    const configured = getAIProviderName() as AIProviderName;
    const provider = getAIProvider();

    if (provider.info.provider === "rule-based") {
      const output = await provider.generateInsights(analyticsData);
      return { ...provider.info, ...output, scoringVersion: SCORING_VERSION };
    }

    // A real provider was configured — try it, then fall back on any failure.
    try {
      const output = await provider.generateInsights(analyticsData);
      return { ...provider.info, ...output, scoringVersion: SCORING_VERSION };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[AI INSIGHT] ${provider.info.providerLabel} failed — using rule-based fallback. ${detail}`);
      const fallback = new RuleBasedAIProvider();
      const output = await fallback.generateInsights(analyticsData);
      return {
        ...fallback.info,
        provider: configured,
        providerLabel: `${provider.info.providerLabel} unavailable — rule-based fallback`,
        connected: false,
        ...output,
        scoringVersion: SCORING_VERSION,
        notice: `The ${provider.info.providerLabel} provider failed (${detail.slice(0, 300)}). Showing deterministic rule-based results instead.`,
      };
    }
  }
}