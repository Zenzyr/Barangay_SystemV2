# AI Insight Layer

This folder isolates all AI-related code so a real LLM provider can be plugged
in later as a drop-in change.

## How it works

```
AnalyticsService.getSummary()            (services/analyticsService.ts)
        │  produces the normalized AnalyticsSummary payload
        ▼
AIInsightService.generateInsights()      (services/ai/aiInsightService.ts)
        │  facade — picks the provider via getAIProvider() / AI_PROVIDER flag
        ▼
Some AIInsightProvider                   (services/ai/aiProviders.ts registry)
        │  currently: RuleBasedAIProvider (mock, no external calls)
        ▼
AIInsightResult                          (types/ai.type.ts)
```

## The interface (input → output)

Input — `AnalyticsSummary` (defined in `types/analytics.type.ts`):

```jsonc
{
  "period":   { "from": "2026-08-01" | null, "to": null, "label": "All time" },
  "overview": {
    "totalRequests": 0, "completionRate": 0, "revenueCollected": 0,
    "weekOverWeekChange": 0, "backlogCount": 0, "pendingUsers": 0,
    "totalUsers": 0, "topDocument": null, "peakDay": null, /* ... */
  },
  "community": {
    "totalResidents": 0, "totalHouseholds": 0,
    "sectorCounts": { /* workingAgePopulation, unemployedHeuristic, ... */ },
    "sectorRates":   { /* unemploymentRateHeuristic, outOfSchoolRateHeuristic, ... */ },
    "topIssues":     [], // fired recommendation rules (category, problem, rate, affectedCount, severity, priorityScore, recommendedProgram)
    "serviceSignals": {}
  },
  "trends": {
    "userGrowth":         [{ "label": "Aug 1", "count": 3 }],
    "engagementOverTime": [{ "label": "Aug 1", "count": 5 }]
  }
}
```

Output — `AIInsightResult` (defined in `types/ai.type.ts`):

```jsonc
{
  "provider":       "rule-based",       // matches AI_PROVIDER value
  "providerLabel":  "Rule-based logic (mock)",
  "connected":      false,              // false until a real model is wired up
  "insights":       [{ "id": "...", "category": "Requests", "title": "...", "why": "...", "action": "...", "severity": "warning|info|positive" }],
  "recommendations":[ /* same shape as insights */ ],
  "confidence":     null                 // 0-1 for LLM providers, null for rule-based
}
```

The `id` fields are human-friendly slugs derived from the item title. The UI
renders `title` as the "Insight", `why` as "Why", and `action` as the
"Suggested Action".

## Contract rules

- Providers read **only** the `AnalyticsSummary` argument. They must never
  query the database — analytics and AI must always see the same numbers.
- Providers return **vendor-neutral** data. Never leak an SDK-specific
  response into `AIInsightOutput`; map it to the shapes above.
- `confidence` should be `null` unless the provider can honestly estimate its
  own reliability.

## Swapping in a real LLM (drop-in)

1. Create a class implementing `AIInsightProvider` from `types/ai.type.ts`
   (one method: `generateInsights(analyticsData): Promise<AIInsightOutput>`).
2. Register it in the `registry` map in `aiProviders.ts`.
3. In `backend/.env`, set `AI_PROVIDER` to the provider key
   (e.g. `AI_PROVIDER=openai`) and add the vendor's API key.

No UI, routes, or `AnalyticsService` changes are required.