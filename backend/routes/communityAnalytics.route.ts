import { Router } from "express";
import { CommunityAnalyticsController } from "../controller/communityAnalytics.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// Community analytics require an authenticated staff account (Secretary +
// Super Admin). No longer publicly accessible.
const analyticsGuard = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];

route.get("/overview", ...analyticsGuard, handler(CommunityAnalyticsController.overview));
route.get("/employment", ...analyticsGuard, handler(CommunityAnalyticsController.employment));
route.get("/education", ...analyticsGuard, handler(CommunityAnalyticsController.education));
route.get("/seniors", ...analyticsGuard, handler(CommunityAnalyticsController.seniors));
route.get("/pwd", ...analyticsGuard, handler(CommunityAnalyticsController.pwd));
route.get("/youth", ...analyticsGuard, handler(CommunityAnalyticsController.youth));
route.get("/social-welfare", ...analyticsGuard, handler(CommunityAnalyticsController.socialWelfare));
route.get("/health", ...analyticsGuard, handler(CommunityAnalyticsController.health));
route.get("/disaster", ...analyticsGuard, handler(CommunityAnalyticsController.disaster));
route.get("/environment", ...analyticsGuard, handler(CommunityAnalyticsController.environment));
route.get("/peace-and-order", ...analyticsGuard, handler(CommunityAnalyticsController.peaceAndOrder));
route.get("/purok", ...analyticsGuard, handler(CommunityAnalyticsController.purok));
route.get("/service-request-signals", ...analyticsGuard, handler(CommunityAnalyticsController.serviceRequestSignals));
route.get("/trends", ...analyticsGuard, handler(CommunityAnalyticsController.trends));
route.get("/recommendations", ...analyticsGuard, handler(CommunityAnalyticsController.recommendations));

export default route;