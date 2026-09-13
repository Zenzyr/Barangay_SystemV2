import RecommendationRuleModel from "../model/recommendationRule.model";
import { CommunityAnalyticsService } from "./communityAnalyticsService";
import { evaluateOperator, getSeverity, getPriorityScore } from "../utils/analyticsRules";

export class RecommendationService {

  /**
   * Evaluates all active recommendation rules against the current analytics
   * snapshot and returns every triggered recommendation, sorted by priority
   * score (highest first). Supports multiple simultaneous recommendations.
   */
  static async generateRecommendations() {
    const rules = await RecommendationRuleModel.find({ status: "active" });
    const { values, affected } = await CommunityAnalyticsService.getIndicatorMap();

    const results = [];

    for (const rule of rules) {
      const value = values[rule.indicator];

      // Skip rules whose indicator isn't computable with current data,
      // rather than silently treating it as 0 (which would misrepresent it).
      if (value === undefined || value === null) continue;

      const triggered = evaluateOperator(value, rule.operator, rule.threshold);
      if (!triggered) continue;

      const affectedCount = affected[rule.indicator] ?? 0;
      const severity = getSeverity(value);
      const priorityScore = getPriorityScore(value, severity, affectedCount);

      results.push({
        ruleId: rule._id,
        category: rule.category,
        problem: rule.problemName,
        indicator: rule.indicator,
        rate: value,
        affectedCount,
        severity,
        priorityScore,
        priorityLevel: rule.priorityLevel,
        recommendedProgram: rule.programName,
        description: rule.description,
      });
    }

    results.sort((a, b) => b.priorityScore - a.priorityScore);
    return results;
  }
}
