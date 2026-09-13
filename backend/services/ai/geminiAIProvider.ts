import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalyticsSummary } from "../../types/analytics.type";
import {
  AIInsightOutput,
  AIInsightProvider,
  AIProviderInfo,
  InsightItem,
  InsightSeverity,
} from "../../types/ai.type";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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
      "severity": "warning | info | positive"
    }
  ],
  "recommendations": [
    {
      "category": "Requests",
      "title": "recommendation headline",
      "why": "reason backed by numbers from the payload",
      "action": "implementable step, barangay-scale (e.g. coordinate with DSWD/DOLE/TESDA)",
      "severity": "warning | info | positive"
    }
  ],
  "confidence": number between 0 and 1, or null
}

Rules:
- severity meaning: "warning" = needs attention now, "info" = monitor, "positive" = good sign.
- 3-6 insights in priority order and 1-4 recommendations maximum.
- Never invent numbers; only use what is in the analytics payload. If the payload is
  sparse or healthy everywhere, say so with a "positive" insight instead of inventing problems.
- Keep titles under ~70 characters. Write in clear, practical English.`;

/**
 * Gemini provider — a real LLM implementation of the AIInsightProvider contract.
 *
 * Uses the official @google/generative-ai SDK with the key from
 * GEMINI_API_KEY (or GOOGLE_API_KEY) in backend/.env. The model is
 * configurable via GEMINI_MODEL (default "gemini-2.0-flash") and the API
 * version via GEMINI_API_VERSION (default "v1beta").
 */
export class GeminiAIProvider implements AIInsightProvider {
  readonly info: AIProviderInfo = {
    provider: "gemini",
    providerLabel: "Gemini",
    connected: true,
  };

  async generateInsights(analyticsData: AnalyticsSummary): Promise<AIInsightOutput> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'AI_PROVIDER=gemini requires GEMINI_API_KEY (or GOOGLE_API_KEY) in backend/.env. ' +
          "Get one for free from Google AI Studio (https://aistudio.google.com/apikey)."
      );
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      {
        model: modelName,
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      },
      { apiVersion: process.env.GEMINI_API_VERSION || "v1beta" }
    );

    const payload = JSON.stringify({
      period: analyticsData.period,
      overview: analyticsData.overview,
      community: analyticsData.community,
      trendsSummary: {
        lastUserGrowthPoints: analyticsData.trends.userGrowth.slice(-4),
        lastEngagementPoints: analyticsData.trends.engagementOverTime.slice(-7),
      },
    });

    const prompt = `${SYSTEM_PROMPT}\n\nAnalytics payload:\n${payload}`;

    let text: string;
    try {
      const result = await model.generateContent(prompt);
      text = result.response.text();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Gemini API request failed (model "${modelName}", provider gemini). ${detail}`
      );
    }

    const raw = parseModelJson(text);
    return normalizeOutput(raw);
  }
}

/** Strip markdown fences / surrounding noise then JSON.parse, throwing on failure. */
function parseModelJson(text: string): AIInsightOutput {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Gemini provider returned no JSON object. Raw output:\n${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as AIInsightOutput;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini provider returned malformed JSON: ${detail}`);
  }
}

/** Coerce whatever the model returned into the strict InsightItem/RecommendationItem shape. */
function normalizeOutput(raw: Partial<AIInsightOutput>): AIInsightOutput {
  const normalizeItem = (item: Record<string, unknown>, fallbackCategory: string): InsightItem | null => {
    const severity = VALID_SEVERITIES.includes(item.severity as InsightSeverity)
      ? (item.severity as InsightSeverity)
      : "info";
    const title = String(item.title ?? "").trim();
    if (!title) return null;
    return {
      id: slug(title).slice(0, 48) || slug(fallbackCategory),
      category: String(item.category ?? fallbackCategory).trim() || fallbackCategory,
      title,
      why: String(item.why ?? "").trim(),
      action: String(item.action ?? "").trim(),
      severity,
    };
  };

  const insights = (Array.isArray(raw.insights) ? raw.insights : [])
    .map((i) => normalizeItem(i as unknown as Record<string, unknown>, "Overall"))
    .filter((x): x is InsightItem => x !== null);

  const recommendations = (Array.isArray(raw.recommendations) ? raw.recommendations : [])
    .map((i) => normalizeItem(i as unknown as Record<string, unknown>, "Overall"))
    .filter((x): x is InsightItem => x !== null);

  const confidence =
    typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1
      ? raw.confidence
      : null;

  return { insights, recommendations, confidence };
}