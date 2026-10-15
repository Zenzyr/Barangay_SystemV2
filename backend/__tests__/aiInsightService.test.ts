jest.mock("../services/ai/geminiAIProvider", () => {
  return {
    GeminiAIProvider: class {
      info = { provider: "gemini", providerLabel: "Gemini", connected: true };
      async generateInsights() {
        throw new Error("simulated Gemini outage");
      }
    },
  };
});

import { AIInsightService } from "../services/ai/aiInsightService";
import { SCORING_VERSION } from "../utils/analyticsRules";
import { emptySummary, stressedSummary } from "./support/fixtures";

const originalProvider = process.env.AI_PROVIDER;

describe("AIInsightService", () => {
  afterEach(() => {
    if (originalProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originalProvider;
  });

  it("uses the rule-based provider directly when AI_PROVIDER=rule-based", async () => {
    process.env.AI_PROVIDER = "rule-based";
    const result = await AIInsightService.generateInsights(emptySummary());
    expect(result.provider).toBe("rule-based");
    expect(result.notice).toBeUndefined();
  });

  it("falls back to rule-based results and announces it when the live provider fails", async () => {
    process.env.AI_PROVIDER = "gemini";
    const result = await AIInsightService.generateInsights(stressedSummary());
    expect(result.provider).toBe("gemini"); // the originally requested provider
    expect(result.connected).toBe(false);
    expect(result.notice).toMatch(/rule-based/i);
    expect(result.providerLabel).toMatch(/unavailable — rule-based fallback/i);
    expect(result.scoringVersion).toBe(SCORING_VERSION);
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("tags every successful result with the shared scoring version", async () => {
    process.env.AI_PROVIDER = "rule-based";
    const result = await AIInsightService.generateInsights(stressedSummary());
    expect(result.scoringVersion).toBe(SCORING_VERSION);
  });
});