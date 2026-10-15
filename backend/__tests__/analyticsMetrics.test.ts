import { classifyOutcome, TRACKED_METRICS, MetricDefinition } from "../utils/analyticsMetrics";
import { emptySummary, stressedSummary } from "./support/fixtures";

const higher = { badDirection: "higherIsWorse" } as Pick<MetricDefinition, "badDirection">;
const lower = { badDirection: "lowerIsWorse" } as Pick<MetricDefinition, "badDirection">;

describe("classifyOutcome", () => {
  it("returns unknown when either side has no value", () => {
    expect(classifyOutcome(higher, null, 5)).toBe("unknown");
    expect(classifyOutcome(higher, 5, null)).toBe("unknown");
    expect(classifyOutcome(higher, null, null)).toBe("unknown");
  });

  it("marks a higher-is-worse drop as improved", () => {
    expect(classifyOutcome(higher, 10, 5)).toBe("improved");
  });

  it("marks a higher-is-worse rise as worsened", () => {
    expect(classifyOutcome(higher, 10, 14)).toBe("worsened");
  });

  it("treats movement inside the tolerance band as unchanged", () => {
    // tolerance = max(1, 10%) = 1 for a baseline of 10
    expect(classifyOutcome(higher, 10, 10.6)).toBe("unchanged");
    expect(classifyOutcome(higher, 10, 9.4)).toBe("unchanged");
    expect(classifyOutcome(higher, 100, 104)).toBe("unchanged"); // 5% of 100 = 5
  });

  it("counts movement beyond the tolerance band as real", () => {
    expect(classifyOutcome(higher, 100, 95)).toBe("improved");
    expect(classifyOutcome(higher, 100, 106)).toBe("worsened");
  });

  it("resolves a higher-is-worse indicator that reaches zero", () => {
    expect(classifyOutcome(higher, 6, 0)).toBe("resolved");
    // boundary: 1 -> 0 is a real fix, not noise
    expect(classifyOutcome(higher, 1, 0)).toBe("resolved");
  });

  it("does not call a zero-baseline metric resolved", () => {
    expect(classifyOutcome(higher, 0, 0)).toBe("unchanged");
  });

  it("inverts direction for lower-is-worse metrics", () => {
    expect(classifyOutcome(lower, 40, 60)).toBe("improved"); // completion rate up
    expect(classifyOutcome(lower, 40, 20)).toBe("worsened");
    expect(classifyOutcome(lower, 40, 41)).toBe("unchanged"); // within tolerance
  });
});

describe("TRACKED_METRICS", () => {
  it("has unique keys and human labels", () => {
    const keys = TRACKED_METRICS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of TRACKED_METRICS) expect(m.label.length).toBeGreaterThan(0);
  });

  it("reads operational metrics out of a summary", () => {
    const summary = stressedSummary();
    const byKey = Object.fromEntries(TRACKED_METRICS.map((m) => [m.key, m.read(summary)]));
    expect(byKey.backlogCount).toBe(9);
    expect(byKey.oldestPendingAgeDays).toBe(6);
    expect(byKey.pendingVerificationCount).toBe(4);
    expect(byKey.pendingUsers).toBe(96);
    expect(byKey.completionRate).toBe(33);
    expect(byKey.seniorCitizenRate).toBe(12.5);
    expect(byKey.unemploymentRateHeuristic).toBe(3);
  });

  it("returns numbers (not throw) for an empty summary", () => {
    const summary = emptySummary();
    for (const m of TRACKED_METRICS) {
      const value = m.read(summary);
      expect(value === null || typeof value === "number").toBe(true);
    }
    // oldestPendingAgeDays is explicitly null when no pending work exists
    const oldest = TRACKED_METRICS.find((m) => m.key === "oldestPendingAgeDays")!;
    expect(oldest.read(summary)).toBeNull();
  });
});
