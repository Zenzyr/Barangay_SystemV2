export type PriorityLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type RuleOperator = ">" | ">=" | "<" | "<=" | "==";
export type RuleStatus = "active" | "inactive";

export interface recommendationRuleInterfaceInput {
  category: string;
  problemName: string;
  indicator: string;
  operator: RuleOperator;
  threshold: number;
  programName: string;
  priorityLevel: PriorityLevel;
  description?: string;
  status: RuleStatus;
}

export interface recommendationRuleInterface extends recommendationRuleInterfaceInput {
  _id: string;
}
