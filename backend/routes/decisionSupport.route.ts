import { Router } from "express";
import { DecisionSupportController } from "../controller/decisionSupport.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// Decision Support is staff-only analytics — same guard as the /analytics
// routes. Residents never reach these endpoints.
const staffOnly = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];

// Explicit + literal paths must come before /:id so ids never shadow them.
route.get("/latest", ...staffOnly, handler(DecisionSupportController.latest));
route.post("/generate", ...staffOnly, handler(DecisionSupportController.generate));
route.get("/history", ...staffOnly, handler(DecisionSupportController.history));
route.get("/:id", ...staffOnly, handler(DecisionSupportController.get));

export default route;