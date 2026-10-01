import { Router } from "express";
import { SuspensionAppealController } from "../controller/suspensionAppeal.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

const superAdminOnly = [authenticateJWT, requireRoles(ROLES.SUPER_ADMIN)];

route.post("/", authenticateJWT, handler(SuspensionAppealController.submit));
route.get("/mine", authenticateJWT, handler(SuspensionAppealController.mine));

route.get("/", ...superAdminOnly, handler(SuspensionAppealController.getAll));
route.patch(
  "/:id",
  ...superAdminOnly,
  handler(SuspensionAppealController.review),
);

export default route;
