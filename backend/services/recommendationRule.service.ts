import RecommendationRuleModel from "../model/recommendationRule.model";
import { recommendationRuleInterfaceInput } from "../types/recommendationRule.type";

export class RecommendationRuleService {

  static async create(data: recommendationRuleInterfaceInput) {
    return await RecommendationRuleModel.create(data);
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await RecommendationRuleModel.find(filter).sort({ category: 1, problemName: 1 });
  }

  static async get(id: string) {
    return await RecommendationRuleModel.findById(id);
  }

  static async update(id: string, data: Partial<recommendationRuleInterfaceInput>) {
    return await RecommendationRuleModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async delete(id: string) {
    return await RecommendationRuleModel.findByIdAndDelete(id);
  }
}
