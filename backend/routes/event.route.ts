import { Router } from "express";
import { EventController } from "../controller/event.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// Any signed-in user (resident/staff) can view events; only operational
// staff may create, edit or delete them.
const staffOnly = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];

route.get("/", authenticateJWT, handler(EventController.getAll));
route.get("/:id", authenticateJWT, handler(EventController.get));

route.post("/", ...staffOnly, handler(EventController.create));
route.patch("/:id", ...staffOnly, handler(EventController.update));
route.delete("/:id", ...staffOnly, handler(EventController.remove));

export default route