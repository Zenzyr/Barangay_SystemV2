import { Router } from "express";
import { WorkController } from "../controller/work.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router()

const staffOnly = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];

route.get("/schedule/config", authenticateJWT, handler(WorkController.getScheduleConfig))
route.get("/schedule/availability", authenticateJWT, handler(WorkController.getAvailability))
route.get("/requests/mine", authenticateJWT, handler(WorkController.getMyRequests))
route.get("/requests", ...staffOnly, handler(WorkController.getAllRequests))
route.patch("/requests/:kind/:id/schedule", ...staffOnly, handler(WorkController.reschedule))
route.patch("/:id/status", authenticateJWT, handler(WorkController.updateStatus))

export default route
