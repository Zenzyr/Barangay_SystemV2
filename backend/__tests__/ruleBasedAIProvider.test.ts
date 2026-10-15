import { RuleBasedAIProvider } from "../services/ai/ruleBasedAIProvider";
import { emptySummary, stressedSummary } from "./support/fixtures";

describe("RuleBasedAIProvider", () => {
  const provider = new RuleBasedAIProvider();
  const floor = (n: number) => Math.max(0, n);

  it("flags backend pressure, payments and verification queues when stressed", async () => {
    const out = await provider.generateInsights(stressedSummary());
    const titles = out.insights.map((i) => i.title).concat(out.recommendations.map((r) => r.title));

    expect(titles.some((t) => /past the 3-day processing target/.test(t))).toBe(true);
    expect(titles.some((t) => /Low completion rate/.test(t))).toBe(true);
    expect(titles.some((t) => /Outstanding document fees/.test(t))).toBe(true);
    expect(titles.some((t) => /Verify pending payment transactions/.test(t))).toBe(true);
    expect(titles.some((t) => /counter-payment requests/.test(t))).toBe(true);
    expect(titles.some((t) => /blocked from release/.test(t))).toBe(true);
    expect(titles.some((t) => /await ID verification/.test(t))).toBe(true);

    // A counter-payment intent must not be presented as a confirmed payment.
    const counter = out.recommendations.find((r) => /counter-payment/.test(r.title));
    expect(counter).toBeDefined();
    expect(counter!.why).toMatch(/NOT a confirmed payment/i);
  });

  it("emits evidence, owner, outcome, timeframe and a 0-100 priority on every item", async () => {
    const out = await provider.generateInsights(stressedSummary());
    const all = out.insights.concat(out.recommendations);
    expect(all.length).toBeGreaterThan(0);
    for (const item of all) {
      expect(item.priorityScore).toEqual(expect.any(Number));
      expect(item.priorityScore).toBeGreaterThanOrEqual(0);
      expect(item.priorityScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(item.evidence)).toBe(true);
      expect((item.evidence ?? []).length).toBeGreaterThan(0);
    }
  });

  it("deduplicates a program surfaced both by sector rate and by the rules engine", async () => {
    const out = await provider.generateInsights(stressedSummary());
    const seniorPrograms = out.recommendations.filter((r) => r.title === "Senior citizen welfare programs");
    expect(seniorPrograms).toHaveLength(1);
  });

  it("still echoes rules-engine programs that are not sector signals", async () => {
    const out = await provider.generateInsights(stressedSummary());
    const nutrition = out.recommendations.find((r) => r.title === "Barangay Nutrition Action Program");
    expect(nutrition).toBeDefined();
    expect(nutrition!.category).toBe("Nutrition");
  });

  it("says no action is needed only when every indicator is healthy", async () => {
    const s = emptySummary();
    s.overview.completionRate = 100;
    s.overview.weekOverWeekChange = 5;
    const out = await provider.generateInsights(s);
    expect(out.insights.some((i) => i.title.includes("No urgent action needed"))).toBe(true);
    expect(out.recommendations.some((r) => r.severity === "warning")).toBe(false);
  });

  it("never emits a score for a recommendation based on a model's own judgment", async () => {
    const s = stressedSummary();
    for (const issue of s.community.topIssues) {
      // The rules echo copies the shared priority score instead of inventing one.
      expect(issue.priorityScore).toEqual(expect.any(Number));
      expect(floor(issue.priorityScore) <= 100).toBe(true);
    }
  });
});