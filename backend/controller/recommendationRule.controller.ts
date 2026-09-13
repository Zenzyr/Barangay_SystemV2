import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { RecommendationRuleService } from "../services/recommendationRule.service";
import { recommendationRuleInterfaceInput } from "../types/recommendationRule.type";
import { isObjectId, isNonEmptyString, withinLength, MAX_SKILL_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from "../utils/validation";

export class RecommendationRuleController {

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const data: recommendationRuleInterfaceInput = request.body;

      if (!isNonEmptyString(data.category) || !isNonEmptyString(data.problemName)) {
        response.status(400).send("category and problemName are required");
        return;
      }
      if (!withinLength(data.category, MAX_SKILL_NAME_LENGTH) || !withinLength(data.problemName, MAX_SKILL_NAME_LENGTH)) {
        response.status(400).send("category and problemName are too long");
        return;
      }

      const rule = await RecommendationRuleService.create(data);
      response.status(201).send(rule);
    } catch (error: any) {
      console.error(error);
      if (error?.name === "ValidationError") {
        response.status(400).send("Invalid recommendation rule data");
        return;
      }
      response.status(500).send("Failed to create recommendation rule");
    }
  };

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { status, category } = request.query;
      const filter: Record<string, any> = {};
      if (status) filter.status = status;
      if (category) filter.category = category;
      const rules = await RecommendationRuleService.getAll(filter);
      response.send(rules);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to fetch recommendation rules");
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid recommendation rule id");
        return;
      }
      const data: Partial<recommendationRuleInterfaceInput> = request.body;
      const rule = await RecommendationRuleService.update(id, data);
      if (!rule) {
        response.status(404).send("Recommendation rule not found");
        return;
      }
      response.send(rule);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to update recommendation rule");
    }
  };

  static delete = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid recommendation rule id");
        return;
      }
      const rule = await RecommendationRuleService.delete(id);
      if (!rule) {
        response.status(404).send("Recommendation rule not found");
        return;
      }
      response.send({ message: "Recommendation rule deleted successfully" });
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to delete recommendation rule");
    }
  };
}
