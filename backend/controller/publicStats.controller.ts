import { Response, Request } from "express";
import { PublicStatsService } from "../services/publicStats.service";

export class PublicStatsController {
  static getStats = async (request: Request, response: Response) => {
    try {
      const stats = await PublicStatsService.getStats();
      response.json(stats);
    } catch (error) {
      console.error("[PUBLIC-STATS-ERROR]", error);
      response.status(500).send("Failed to fetch public statistics");
    }
  };
}
