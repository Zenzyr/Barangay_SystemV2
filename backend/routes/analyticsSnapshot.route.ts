import { Router } from "express";
import { AnalyticsSnapshotController } from "../controller/analyticsSnapshot.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// Operational staff guards (mirrors the Decision Support routes).
const staffOnly = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];

// Read-only snapshot retrieval. Snapshots are only ever created by
// POST /decision-support/generate — none of these routes write anything.
route.get("/latest", ...staffOnly, handler(AnalyticsSnapshotController.latest));
route.get("/history", ...staffOnly, handler(AnalyticsSnapshotController.history));
route.get("/:id", ...staffOnly, handler(AnalyticsSnapshotController.get));

export default route