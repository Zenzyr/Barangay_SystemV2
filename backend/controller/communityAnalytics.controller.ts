import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { CommunityAnalyticsService } from "../services/communityAnalyticsService";
import { RecommendationService } from "../services/recommendationService";

export class CommunityAnalyticsController {

  static overview = async (request: AuthRequest, response: Response) => {
    try {
      const data = await CommunityAnalyticsService.getOverview();
      response.send(data);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute overview analytics");
    }
  };

  static employment = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getEmploymentSector());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute employment analytics");
    }
  };

  static education = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getEducationSector());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute education analytics");
    }
  };

  static seniors = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getSeniorSector());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute senior citizen analytics");
    }
  };

  static pwd = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getPwdSector());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute PWD analytics");
    }
  };

  static youth = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getYouthSector());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute youth analytics");
    }
  };

  static socialWelfare = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getSocialWelfareSector());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute social welfare analytics");
    }
  };

  static health = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getHealthSector());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute health analytics");
    }
  };

  static disaster = async (request: AuthRequest, response: Response) => {
    response.send(CommunityAnalyticsService.getUnavailableSector("Disaster Risk"));
  };

  static environment = async (request: AuthRequest, response: Response) => {
    response.send(CommunityAnalyticsService.getUnavailableSector("Environment"));
  };

  static peaceAndOrder = async (request: AuthRequest, response: Response) => {
    response.send(CommunityAnalyticsService.getUnavailableSector("Peace and Order"));
  };

  static purok = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getPurokAnalysis());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute purok analytics");
    }
  };

  static serviceRequestSignals = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getServiceRequestSignals());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute service request signals");
    }
  };

  static trends = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await CommunityAnalyticsService.getHistoricalTrends());
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to compute historical trends");
    }
  };

  static recommendations = async (request: AuthRequest, response: Response) => {
    try {
      const data = await RecommendationService.generateRecommendations();
      response.send(data);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to generate recommendations");
    }
  };
}
