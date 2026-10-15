import { GeminiAIProvider, normalizeOutput, parseModelJson } from "../services/ai/geminiAIProvider";

describe("parseModelJson", () => {
  it("parses plain JSON", () => {
    const out = parseModelJson('{"insights": [], "recommendations": [], "confidence": 0.7}');
    expect(out.confidence).toBe(0.7);
    expect(out.insights).toEqual([]);
  });

  it("strips markdown code fences", () => {
    const out = parseModelJson('```json\n{"insights": [], "recommendations": [], "confidence": null}\n```');
    expect(out.recommendations).toEqual([]);
  });

  it("throws on garbage output so the caller can fall back", () => {
    expect(() => parseModelJson("I'm sorry, I can't do that.")).toThrow(/no JSON object/);
    expect(() => parseModelJson("{broken")).toThrow(/no JSON object/);
    expect(() => parseModelJson('{"insights": }')).toThrow(/malformed JSON/);
  });
});

describe("normalizeOutput", () => {
  it("drops malformed items and coerces unknown severities to info", () => {
    const out = normalizeOutput({
      insights: [
        { title: "", why: "missing title -> dropped", severity: "warning" },
        { title: "  ", why: "blank title -> dropped" },
        {
          title: "Valid insight",
          why: "cites the numbers",
          action: "do a thing",
          severity: "CRITICAL", // not a valid UI severity
          evidence: ["backlogCount: 3", "", "   "],
        },
      ],
      recommendations: "not-an-array",
      confidence: 99, // out of range -> null
    } as any);

    expect(out.insights).toHaveLength(1);
    expect(out.insights[0].severity).toBe("info");
    expect(out.insights[0].evidence).toEqual(["backlogCount: 3"]);
    expect(out.recommendations).toEqual([]);
    expect(out.confidence).toBeNull();
  });

  it("never adds a model-invented priority score", async () => {
    const out = normalizeOutput({
      insights: [
        {
          title: "A suggestion",
          why: "reason",
          severity: "warning",
          priorityScore: 88, // models must not score themselves
        },
      ],
      recommendations: [],
      confidence: null,
    } as any);

    expect(out.insights[0].priorityScore).toBeUndefined();
  });

  it("keeps valid ratings and confidence", () => {
    const out = normalizeOutput({
      insights: [{ title: "A", why: "b", severity: "positive", evidence: ["x"] }],
      recommendations: [{ title: "R", why: "w", severity: "warning", evidence: ["y"] }],
      confidence: 0.5,
    } as any);
    expect(out.insights[0].severity).toBe("positive");
    expect(out.recommendations[0].evidence).toEqual(["y"]);
    expect(out.confidence).toBe(0.5);
  });
});

describe("GeminiAIProvider", () => {
  it("throws a clear error when no API key is configured", async () => {
    const provider = new GeminiAIProvider();
    const prev = {
      AI_ANALYTICS_API_KEY: process.env.AI_ANALYTICS_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    };
    delete process.env.AI_ANALYTICS_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(provider.generateInsights({} as any)).rejects.toThrow(/requires AI_ANALYTICS_API_KEY/);
    process.env.AI_ANALYTICS_API_KEY = prev.AI_ANALYTICS_API_KEY;
    process.env.GEMINI_API_KEY = prev.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = prev.GOOGLE_API_KEY;
  });
});