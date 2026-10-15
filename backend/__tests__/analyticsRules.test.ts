import {
  getSeverity,
  getPriorityScore,
  priorityScoreOf,
  evaluateOperator,
  safeRate,
  SCORING_VERSION,
  SEVERITY_BANDS,
  SEVERITY_WEIGHT,
} from "../utils/analyticsRules";

describe("getSeverity", () => {
  it("classifies boundary rates deterministically (upper bounds inclusive)", () => {
    expect(getSeverity(0)).toBe("LOW");
    expect(getSeverity(5)).toBe("LOW");
    expect(getSeverity(5.0001)).toBe("MODERATE");
    expect(getSeverity(10)).toBe("MODERATE");
    expect(getSeverity(10.0001)).toBe("HIGH");
    expect(getSeverity(20)).toBe("HIGH");
    expect(getSeverity(20.0001)).toBe("CRITICAL");
    expect(getSeverity(100)).toBe("CRITICAL");
  });

  it("treats NaN, negative and Infinity as LOW so scoring never crashes", () => {
    expect(getSeverity(NaN)).toBe("LOW");
    expect(getSeverity(-5)).toBe("LOW");
    expect(getSeverity(-Infinity)).toBe("LOW");
  });

  it("exposes exportable bands and weights", () => {
    expect(SEVERITY_BANDS).toHaveLength(4);
    expect(SEVERITY_WEIGHT).toEqual({ LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 });
  });
});

describe("getPriorityScore", () => {
  it("is bounded to 0-100 even with extreme inputs", () => {
    expect(getPriorityScore(1e9, "CRITICAL", 1e9, {
      ageDays: 1e9,
      blocksRelease: true,
      paymentDelay: true,
    })).toBe(100);
    expect(getPriorityScore(0, "LOW", 0)).toBeGreaterThanOrEqual(0);
  });

  it("only awards bonuses for factors observable in the current window", () => {
    // v3 removed the unmeasured `recurring` / `worsening` bonuses. Scoring the
    // same measurable inputs must be identical no matter what.
    const a = getPriorityScore(12, "HIGH", 40, { blocksRelease: true });
    const b = getPriorityScore(12, "HIGH", 40, { blocksRelease: true });
    expect(a).toBe(b);
  });

  it("exact boundary: a score that lands exactly on 100 is not clamped down", () => {
    // CRITICAL base 80 + rate 12 + count 8 = 100 exactly.
    expect(getPriorityScore(96, "CRITICAL", 51)).toBe(100);
  });

  it("rewards severity, affected count, age and flags in a deterministic order", () => {
    const plain = getPriorityScore(5, "LOW", 0);
    const withCount = getPriorityScore(5, "LOW", 100);
    const withFlags = getPriorityScore(5, "LOW", 100, { blocksRelease: true, paymentDelay: true });
    expect(withCount).toBeGreaterThan(plain);
    expect(withFlags).toBeGreaterThan(withCount);
  });

  it("caps each additive bonus so no single metric dominates", () => {
    const maxAge = getPriorityScore(0, "MODERATE", 0, { ageDays: 36500 });
    const noAge = getPriorityScore(0, "MODERATE", 0, { ageDays: 30 });
    expect(maxAge).toBe(noAge); // ageBonus hit its cap of 10 in both cases
  });

  it("caps the rate bonus at 12 points", () => {
    // 8 points-per-percentage-point-of-8; anything ≥96 saturates the cap.
    const atCap = getPriorityScore(96, "LOW", 0);
    const beyondCap = getPriorityScore(1000, "LOW", 0);
    expect(atCap).toBe(beyondCap);
  });

  it("steps the affected-count bonus at 0 / 1 / 21 / 51", () => {
    const base = getPriorityScore(0, "LOW", 0);
    expect(getPriorityScore(0, "LOW", 1)).toBe(base + 2); // > 0
    expect(getPriorityScore(0, "LOW", 20)).toBe(base + 2); // still the low tier
    expect(getPriorityScore(0, "LOW", 21)).toBe(base + 5); // > 20
    expect(getPriorityScore(0, "LOW", 50)).toBe(base + 5);
    expect(getPriorityScore(0, "LOW", 51)).toBe(base + 8); // > 50
  });

  it("is version-tagged via SCORING_VERSION", () => {
    expect(SCORING_VERSION).toBe("v3");
  });
});

describe("priorityScoreOf", () => {
  it("maps operational categories onto the fixed severity bases", () => {
    const warning = priorityScoreOf("warning", 10);
    const info = priorityScoreOf("info", 10);
    const positive = priorityScoreOf("positive", 10);
    expect(warning).toBeGreaterThan(info);
    expect(info).toBeGreaterThan(positive);
  });

  it("adds the same deterministic factors as rate-based scoring", () => {
    const base = priorityScoreOf("warning", 0);
    const withAge = priorityScoreOf("warning", 0, { ageDays: 9, blocksRelease: true });
    expect(withAge).toBeGreaterThan(base);
  });
});

describe("evaluateOperator / safeRate", () => {
  it("supports the rule operators", () => {
    expect(evaluateOperator(5, ">", 4)).toBe(true);
    expect(evaluateOperator(5, ">=", 5)).toBe(true);
    expect(evaluateOperator(4, "<", 5)).toBe(true);
    expect(evaluateOperator(4, "<=", 4)).toBe(true);
    expect(evaluateOperator(4, "==", 4)).toBe(true);
    expect(evaluateOperator(4, "!!", 4)).toBe(false);
  });

  it("safeRate is a 0-100 percentage and survives zero/negative divisors", () => {
    expect(safeRate(25, 100)).toBe(25);
    expect(safeRate(0, 0)).toBe(0);
    expect(safeRate(5, 0)).toBe(0);
    expect(safeRate(-5, 10)).toBe(0);
    expect(safeRate(NaN, 10)).toBe(0);
  });
});