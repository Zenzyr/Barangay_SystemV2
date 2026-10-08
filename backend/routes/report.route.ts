import { Router } from "express";
import { ReportController } from "../controller/report.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

route.get("/", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN, ROLES.TREASURER), handler(ReportController.generate));

export default route;
