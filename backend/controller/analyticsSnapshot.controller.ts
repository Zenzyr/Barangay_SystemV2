import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { AnalyticsSnapshotService } from "../services/analyticsSnapshot.service";
import { isObjectId } from "../utils/validation";

/**
 * Read-only AnalyticsSnapshot endpoints. None of these handlers ever create,
 * update or delete a snapshot — snapshots are only written at Decision Support
 * generation time (POST /decision-support/generate).
 */
export class AnalyticsSnapshotController {

  /** GET /analytics-snapshots/latest — the most recent captured snapshot. */
  static latest = async (request: AuthRequest, response: Response) => {
    try {
      const snapshot = await AnalyticsSnapshotService.getLatest();
      if (!snapshot) {
        response.status(404).json({ message: "No analytics snapshot has been captured yet." });
        return;
      }
      response.send(snapshot);
    } catch (error) {
      console.error("[ANALYTICS SNAPSHOT LATEST ERROR]", error);
      response.status(500).send("Failed to fetch the latest analytics snapshot");
    }
  };

  /** GET /analytics-snapshots/history — previously captured snapshots. */
  static history = async (request: AuthRequest, response: Response) => {
    try {
      const limitRaw = Number(request.query.limit);
      const snapshots = await AnalyticsSnapshotService.getHistory(
        Number.isFinite(limitRaw) ? limitRaw : undefined,
      );
      response.send(snapshots);
    } catch (error) {
      console.error("[ANALYTICS SNAPSHOT HISTORY ERROR]", error);
      response.status(500).send("Failed to fetch analytics snapshot history");
    }
  };

  /** GET /analytics-snapshots/:id — one specific captured snapshot. */
  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid analytics snapshot id");
        return;
      }
      const snapshot = await AnalyticsSnapshotService.get(id);
      if (!snapshot) {
        response.status(404).send("Analytics snapshot not found");
        return;
      }
      response.send(snapshot);
    } catch (error) {
      console.error("[ANALYTICS SNAPSHOT GET ERROR]", error);
      response.status(500).send("Failed to fetch analytics snapshot");
    }
  };
}