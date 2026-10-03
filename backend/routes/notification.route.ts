import { Router } from "express";
import { NotificationController } from "../controller/notification.controller";
import { authenticateJWT } from "../middleware/auth";
import { handler } from "../utils/handler";

const route = Router()

route.get("/:accountId", authenticateJWT, handler(NotificationController.getByAccount))
route.patch("/:accountId/read-all", authenticateJWT, handler(NotificationController.markAllAsRead))
route.patch("/:id/read", authenticateJWT, handler(NotificationController.markAsRead))

export default route
