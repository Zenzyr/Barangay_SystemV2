import { GoogleGenAI } from "@google/genai";
import { AnalyticsSummary } from "../../types/analytics.type";
import {
  AIInsightOutput,
  AIInsightProvider,
  AIProviderInfo,
  InsightItem,
  InsightSeverity,
  RecommendationItem,
} from "../../types/ai.type";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const VALID_SEVERITIES: InsightSeverity[] = ["warning", "info", "positive"];

const SYSTEM_PROMPT = `You are a barangay (village) operations analyst for the Philippines.
You receive a normalized analytics summary (JSON) for a rural barangay and must return
an operational briefing the Barangay Secretary / Punong Barangay can act on TODAY.

Return ONLY valid JSON — no markdown, no code fences, no commentary — matching exactly:

{
  "insights": [
    {
      "category": "Requests",
      "title": "short headline (the observation)",
      "why": "2-3 sentences citing the exact numbers from the analytics payload",
      "action": "one concrete step the secretary can take",
      "severity": "warning | info | positive",
      "evidence": ["array", "of", "the exact numbers from the payload that support this item"],
      "responsibleRole": "staff role that should own this, when the payload makes it identifiable",
      "expectedOutcome": "what success looks like",
      "timeframe": "e.g. This week / Within 3 days / Next 2 weeks"
    }
  ],
  "recommendations": [
    {
      "category": "Requests",
      "title": "recommendation headline",
      "why": "reason backed by numbers from the payload",
      "action": "implementable step, barangay-scale (e.g. coordinate with DSWD/DOLE/TESDA)",
      "severity": "warning | info | positive",
      "evidence": ["array of the numbers/indicators that TRIGGERED this recommendation"],
      "responsibleRole": "staff role that should own this, when identifiable",
      "expectedOutcome": "what success looks like",
      "timeframe": "e.g. This week / Next 2 weeks / This quarter"
    }
  ],
  "confidence": number between 0 and 1, or null
}

Rules:
- severity meaning: "warning" = needs attention now, "info" = monitor, "positive" = good sign.
- 3-6 insights in priority order and 1-4 recommendations maximum.
- CRITICAL: cite the exact payload numbers in "evidence". NEVER invent metrics, residents,
  payments, causes, or completed actions. If the payload does not support a claim, do not make the claim.
- Every recommendation MUST name the indicator(s) that triggered it in "evidence" (e.g.
  ["backlogCount: 7", "unpaidCount: 3"]). A recommendation without supporting indicators is invalid.
- A counter-payment intent ("counterPaymentCount") is NOT a confirmed payment — say so if relevant.
- Never present unavailable metrics as if they existed; the payload lists its own limitations.
- Keep titles under ~70 characters. Write in clear, practical English.`;

/**
 * Live LLM provider (Gemini) for Decision Support. Reads ONLY the aggregate
 * AnalyticsSummary payload (no PII) and returns strictly normalized JSON.
 * Any API failure/timeout/rate-limit is raised so AIInsightService can fall
 * back to the deterministic rule-based provider.
 */
export class GeminiAIProvider implements AIInsightProvider {
  readonly info: AIProviderInfo = {
    provider: "gemini",
    providerLabel: "Gemini",
    connected: true,
  };

  async generateInsights(
    analyticsData: AnalyticsSummary,
  ): Promise<AIInsightOutput> {
    const apiKey =
      process.env.AI_ANALYTICS_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI_PROVIDER=gemini requires AI_ANALYTICS_API_KEY (or GEMINI_API_KEY / GOOGLE_API_KEY) in backend/.env. " +
          "Get one for free from Google AI Studio (https://aistudio.google.com/apikey).",
      );
    }

    const modelName =
      (process.env.AI_ANALYTICS_MODEL as string) ||
      (process.env.GEMINI_MODEL as string) ||
      "gemini-3.6-flash";
    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: process.env.GEMINI_API_VERSION || "v1beta",
    });

    // Only normalized aggregates are ever sent out — never names, addresses,
    // phones, emails, IDs, or document scans.
    const payload = JSON.stringify({
      period: analyticsData.period,
      overview: analyticsData.overview,
      community: analyticsData.community,
      trendsSummary: {
        lastUserGrowthPoints: analyticsData.trends.userGrowth.slice(-4),
        lastEngagementPoints: analyticsData.trends.engagementOverTime.slice(-7),
      },
      limitations: analyticsData.limitations,
    });

    const prompt = `${SYSTEM_PROMPT}\n\nAnalytics payload:\n${payload}`;

    let text: string;
    try {
      text = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { temperature: 0.3, maxOutputTokens: 8192 },
        }).then((result: any) => result.text ?? ""),
        timeoutMs(),
        `Gemini request timed out after ${timeoutMs()}ms`,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Gemini API request failed (model "${modelName}", provider gemini). ${detail}`,
      );
    }

    const raw = parseModelJson(text);
    return normalizeOutput(raw);
  }
}

const timeoutMs = (): number => {
  const parsed = Number(process.env.AI_ANALYTICS_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
};

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Strip markdown fences / surrounding noise then JSON.parse, throwing on failure. */
export function parseModelJson(text: string): AIInsightOutput {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `Gemini provider returned no JSON object. Raw output:\n${text.slice(0, 500)}`,
    );
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as AIInsightOutput;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini provider returned malformed JSON: ${detail}`);
  }
}

/**
 * Coerce whatever the model returned into the strict InsightItem /
 * RecommendationItem shape. Malformed items are dropped, never saved unvalidated.
 * A lost priority score is never inferred — models cannot change scores.
 */
export function normalizeOutput(raw: Partial<AIInsightOutput>): AIInsightOutput {
  const normalizeItem = (
    item: Record<string, unknown>,
  ): InsightItem | RecommendationItem | null => {
    if (!item || typeof item !== "object") return null;
    const severity = VALID_SEVERITIES.includes(item.severity as InsightSeverity)
      ? (item.severity as InsightSeverity)
      : "info";
    const title = String(item.title ?? "").trim();
    if (!title) return null;

    const evidence = Array.isArray(item.evidence)
      ? item.evidence
          .map((e) => String(e ?? "").trim())
          .filter(Boolean)
          .slice(0, 12)
      : [];

    return {
      id: slug(title).slice(0, 48),
      category: String(item.category ?? "Overall").trim() || "Overall",
      title,
      why: String(item.why ?? "").trim(),
      action: String(item.action ?? "").trim(),
      severity,
      evidence,
      responsibleRole: typeof item.responsibleRole === "string" ? item.responsibleRole.trim() : undefined,
      expectedOutcome: typeof item.expectedOutcome === "string" ? item.expectedOutcome.trim() : undefined,
      timeframe: typeof item.timeframe === "string" ? item.timeframe.trim() : undefined,
    };
  };

  const insights = (Array.isArray(raw.insights) ? raw.insights : [])
    .map((i) => normalizeItem(i as unknown as Record<string, unknown>))
    .filter((x): x is InsightItem => x !== null);

  const recommendations = (Array.isArray(raw.recommendations) ? raw.recommendations : [])
    .map((i) => normalizeItem(i as unknown as Record<string, unknown>))
    .filter((x): x is RecommendationItem => x !== null);

  const confidence =
    typeof raw.confidence === "number" &&
    raw.confidence >= 0 &&
    raw.confidence <= 1
      ? raw.confidence
      : null;

  return { insights, recommendations, confidence };
}