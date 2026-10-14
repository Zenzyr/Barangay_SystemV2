import {
  AIInsightOutput,
  AIInsightProvider,
  AIProviderInfo,
  AIProviderName,
} from "../../types/ai.type";
import { RuleBasedAIProvider } from "./ruleBasedAIProvider";
import { GeminiAIProvider } from "./geminiAIProvider";

/**
 * Placeholder for providers that are announced via AI_PROVIDER but have not
 * been implemented yet. Selecting one raises a clear error instead of silently
 * degrading, so a misconfiguration can never be mistaken for a working AI.
 *
 * To add a real provider (e.g. OpenAI, Anthropic):
 *   1. Create e.g. openaiAIProvider.ts exporting a class implementing
 *      AIInsightProvider. Map the vendor response into AIInsightOutput.
 *   2. Register it in the `registry` map below.
 *   3. Set AI_PROVIDER=openai (and the vendor's key) in backend/.env.
 */
class UnimplementedProvider implements AIInsightProvider {
  constructor(readonly info: AIProviderInfo) {}

  async generateInsights(): Promise<AIInsightOutput> {
    throw new Error(
      `AI provider "${this.info.provider}" is referenced in AI_PROVIDER but is not implemented yet. ` +
        `Add a provider class implementing AIInsightProvider and register it in backend/services/ai/aiProviders.ts.`
    );
  }
}

const registry: Record<string, () => AIInsightProvider> = {
  "rule-based": () => new RuleBasedAIProvider(),
  // Future provider slots — flipping AI_PROVIDER (plus an API key) is the only
  // config change needed once a class is registered here.
  openai: () =>
    new UnimplementedProvider({
      provider: "openai",
      providerLabel: "OpenAI (not connected)",
      connected: false,
    }),
  anthropic: () =>
    new UnimplementedProvider({
      provider: "anthropic",
      providerLabel: "Anthropic (not connected)",
      connected: false,
    }),
  gemini: () => new GeminiAIProvider(),
};

/**
 * Returns the AI insight provider selected by the AI_PROVIDER env flag.
 * Defaults to the rule-based (mock) provider when nothing is configured.
 */
export function getAIProvider(providerName?: AIProviderName): AIInsightProvider {
  const name = getAIProviderName(providerName);
  const factory = registry[name] || registry["rule-based"];
  return factory();
}

/**
 * The raw configured/requested provider name (lowercased), without resolving
 * it through the registry — used when a provider fails so the fallback can
 * still describe what was originally requested.
 */
export function getAIProviderName(providerName?: AIProviderName): string {
  return String(providerName || process.env.AI_PROVIDER || "rule-based")
    .toLowerCase()
    .trim();
}