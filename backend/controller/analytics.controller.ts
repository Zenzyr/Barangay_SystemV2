import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { AnalyticsService } from "../services/analyticsService";
import { AIInsightService } from "../services/ai/aiInsightService";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export class AnalyticsController {
  /** GET /analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD — normalized data. */
  static summary = async (request: AuthRequest, response: Response) => {
    try {
      const data = await AnalyticsService.getSummary({
        from: asString(request.query.from),
        to: asString(request.query.to),
      });
      response.send(data);
    } catch (error) {
      console.error("[ANALYTICS SUMMARY ERROR]", error);
      response.status(500).send("Failed to compute analytics summary");
    }
  };

  /** GET /analytics/insights — data + AI recommendations via the configured provider. */
  static insights = async (request: AuthRequest, response: Response) => {
    try {
      const data = await AnalyticsService.getSummary({
        from: asString(request.query.from),
        to: asString(request.query.to),
      });
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