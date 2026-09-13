import { Router } from "express";
import { AnalyticsController } from "../controller/analytics.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// Analytics are no longer public — they require an authenticated staff account.
// Secretary: VIEW/USE. Super Admin: VIEW/USE/CONFIGURE.
const analyticsGuard = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];

// Unified analytics data service (single source of truth).
route.get("/summary", ...analyticsGuard, handler(AnalyticsController.summary));

// Same data, fed through the AI insight provider selected by AI_PROVIDER.
route.get("/insights", ...analyticsGuard, handler(AnalyticsController.insights));

export default route;