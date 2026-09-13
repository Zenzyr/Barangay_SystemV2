import { AnalyticsSummary } from "../../types/analytics.type";
import { AIInsightResult } from "../../types/ai.type";
import { getAIProvider } from "./aiProviders";

/**
 * AIInsightService — the single entry point the rest of the app uses to get
 * AI-driven decision support. It reads analytics from the AnalyticsSummary it
 * is given (never queries the database itself) and delegates to whichever
 * provider is selected by the AI_PROVIDER env flag.
 *
 * Swapping the provider is a config change, not a code change, everywhere
 * outside of services/ai/.
 */
export class AIInsightService {
  static async generateInsights(analyticsData: AnalyticsSummary): Promise<AIInsightResult> {
    const provider = getAIProvider();
    const output = await provider.generateInsights(analyticsData);
    return {
      ...provider.info,
      ...output,
    };
  }
}