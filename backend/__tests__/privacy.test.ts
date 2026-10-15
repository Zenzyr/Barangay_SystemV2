import { emptySummary, stressedSummary } from "./support/fixtures";
import { RuleBasedAIProvider } from "../services/ai/ruleBasedAIProvider";

// Fields that must NEVER appear in an AnalyticsSummary, because the aggregate
// is what gets handed to AI providers and stored in decision-support snapshots.
const FORBIDDEN_KEYS = new Set([
  "fullName",
  "firstName",
  "middleName",
  "lastName",
  "nickname",
  "email",
  "emailAddress",
  "contact",
  "contactNumber",
  "phone",
  "phoneNumber",
  "mobile",
  "address",
  "homeAddress",
  "password",
  "idFront",
  "idBack",
  "dateOfBirth",
  "spouseName",
  "receiptNumber",
]);

function collectKeys(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((v) => collectKeys(v, keys));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      keys.add(k);
      collectKeys(v, keys);
    }
  }
}

describe("privacy: the aggregate AnalyticsSummary is PII-free", () => {
  it.each([
    ["healthy", emptySummary()],
    ["stressed", stressedSummary()],
  ])("carries no personally-identifiable fields in the %s summary", (_label, summary) => {
    const keys = new Set<string>();
    collectKeys(summary, keys);
    const violations = [...keys].filter((k) => FORBIDDEN_KEYS.has(k));
    expect(violations).toEqual([]);
  });

  it("keeps resident-level detail out of topIssues echoing", () => {
    const summary = stressedSummary();
    // The community snapshot must stay at aggregate level even inside rules output.
    const keys = new Set<string>();
    collectKeys(summary.community, keys);
    const violations = [...keys].filter((k) => FORBIDDEN_KEYS.has(k));
    expect(violations).toEqual([]);
  });
});

// Text-shaped PII that a template could accidentally interpolate even though
// the summary itself carries no such keys.
const FORBIDDEN_TEXT_PATTERNS = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // e-mail address
  /\b(?:\+?63|0)9\d{2}[- ]?\d{3}[- ]?\d{4}\b/, // PH mobile number
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/, // 16-digit ID / card number
];

describe("privacy & integrity: rule-based AI output", () => {
  const provider = new RuleBasedAIProvider();

  it("never leaks forbidden keys into the insight payload", async () => {
    const out = await provider.generateInsights(stressedSummary());
    const keys = new Set<string>();
    collectKeys(out, keys);
    expect([...keys].filter((k) => FORBIDDEN_KEYS.has(k))).toEqual([]);
  });

  it("embeds no e-mails, phone numbers or long id sequences in any text field", async () => {
    const out = await provider.generateInsights(stressedSummary());
    const text = JSON.stringify(out);
    for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("deduplicates by category+title across insights AND recommendations", async () => {
    const out = await provider.generateInsights(stressedSummary());
    const all = [...out.insights, ...out.recommendations];
    const keys = all.map((i) => `${i.category}|${i.title}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is deterministic — repeated runs produce identical ids and scores", async () => {
    const squared = (r: Awaited<ReturnType<RuleBasedAIProvider["generateInsights"]>>) =>
      [...r.insights, ...r.recommendations].map((i) => ({
        id: i.id,
        category: i.category,
        title: i.title,
        severity: i.severity,
        priorityScore: i.priorityScore,
      }));
    const run1 = squared(await provider.generateInsights(stressedSummary()));
    const run2 = squared(await provider.generateInsights(stressedSummary()));
    expect(run1).toEqual(run2);
  });
});