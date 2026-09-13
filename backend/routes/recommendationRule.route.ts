import { Router } from "express";
import { RecommendationRuleController } from "../controller/recommendationRule.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// Rule READ is available to operational staff so the secretary can view
// recommendations. WRITE operations are system configuration → super admin only.
route.get("/", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(RecommendationRuleController.getAll));
route.post("/", authenticateJWT, requireRoles(ROLES.SUPER_ADMIN), handler(RecommendationRuleController.create));
route.put("/:id", authenticateJWT, requireRoles(ROLES.SUPER_ADMIN), handler(RecommendationRuleController.update));
route.delete("/:id", authenticateJWT, requireRoles(ROLES.SUPER_ADMIN), handler(RecommendationRuleController.delete));

export default route;