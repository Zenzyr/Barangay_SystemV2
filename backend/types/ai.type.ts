/**
 * AIInsightService interface contract
 * ===================================
 *
 * INPUT  (AnalyticsSummary): the normalized payload produced by
 *         `AnalyticsService.getSummary()` (types/analytics.type.ts).
 *         This is the ONLY data shape an AI provider may read. Providers
 *         must NOT query the database directly — that keeps analytics and
 *         the AI layer locked to the same numbers.
 *
 * OUTPUT (AIInsightOutput): a provider-agnostic, vendor-neutral object:
 *         - `insights`       = observations ("what is happening"),
 *         - `recommendations`= suggested actions ("what to do about it"),
 *         - `confidence`     = 0-1 if the provider can estimate reliability,
 *                              otherwise null (rule-based providers return null).
 *
 * SWAPPING A REAL LLM LATER (drop-in, no changes outside this pipeline):
 *   1. Add a provider class implementing `AIInsightProvider` (one method).
 *   2. Register it in the factory at services/ai/aiProviders.ts.
 *   3. Set `AI_PROVIDER=openai|anthropic|gemini|...` in backend/.env.
 *   No UI, route, or AnalyticsService changes are required.
 */

import { AnalyticsSummary } from "./analytics.type";

export type InsightSeverity = "warning" | "info" | "positive";

/** Optional, provider-agnostic metadata that enriches an insight/recommendation. */
export interface InsightMeta {
  /** The raw numbers from the analytics payload that support this item. */
  evidence?: string[];
  /** Staff role that should own the follow-up, when identifiable. */
  responsibleRole?: string;
  /** What success looks like once the action is taken. */
  expectedOutcome?: string;
  /** Suggested timeframe, e.g. "This week", "Within 3 days". */
  timeframe?: string;
  /** Deterministic priority score (0-100) — never set by the model. */
  priorityScore?: number;
}

export interface InsightItem extends InsightMeta {
  id: string;
  category: string;
  title: string; // "Insight" — the observation
  why: string; // "Why" — evidence drawn from the analytics data
  action: string; // "Suggested action" — what the secretary can do
  severity: InsightSeverity;
}

export interface RecommendationItem extends InsightMeta {
  id: string;
  category: string;
  title: string; // "Recommendation" headline
  why: string; // reason / supporting evidence
  action: string; // concrete implementation step
  severity: InsightSeverity;
}

export interface AIInsightOutput {
  insights: InsightItem[];
  recommendations: RecommendationItem[];
  confidence: number | null;
}

export type AIProviderName = "rule-based" | "openai" | "anthropic" | "gemini" | (string & {});

export interface AIProviderInfo {
  provider: AIProviderName; // machine name — matches the AI_PROVIDER env value
  providerLabel: string; // human label shown on the Decision Support badge
  connected: boolean; // false while a real model isn't wired up
}

/** Provider output + provider metadata. `notice` only appears on fallback. */
export type AIInsightResult = AIInsightOutput &
  AIProviderInfo & {
    notice?: string;
    scoringVersion?: string;
  };

/** Contract every AI provider must implement. */
export interface AIInsightProvider {
  readonly info: AIProviderInfo;
  generateInsights(analyticsData: AnalyticsSummary): Promise<AIInsightOutput>;
}