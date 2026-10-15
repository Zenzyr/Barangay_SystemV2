import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { AnalyticsService } from "../services/analyticsService";
import { AIInsightService } from "../services/ai/aiInsightService";
import { parseDateRange } from "../utils/validation";

export class AnalyticsController {
  /** GET /analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD — normalized data. */
  static summary = async (request: AuthRequest, response: Response) => {
    try {
      const { from, to, error } = parseDateRange({
        from: request.query.from,
        to: request.query.to,
      });
      if (error) {
        response.status(400).json({ message: error });
        return;
      }
      const data = await AnalyticsService.getSummary({ from, to });
      response.send(data);
    } catch (error) {
      console.error("[ANALYTICS SUMMARY ERROR]", error);
      response.status(500).send("Failed to compute analytics summary");
    }
  };

  /** GET /analytics/insights?from=YYYY-MM-DD&to=YYYY-MM-DD — data + AI recommendations. */
  static insights = async (request: AuthRequest, response: Response) => {
    try {
      const { from, to, error } = parseDateRange({
        from: request.query.from,
        to: request.query.to,
      });
      if (error) {
        response.status(400).json({ message: error });
        return;
      }
      const data = await AnalyticsService.getSummary({ from, to });
      const result = await AIInsightService.generateInsights(data);
      response.send({ ...result, period: data.period });
    } catch (error) {
      console.error("[ANALYTICS INSIGHTS ERROR]", error);
      response.status(500).json({
        message: "Failed to generate insights",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}