import { Router } from "express";
import { NotificationController } from "../controller/notification.controller";
import { handler } from "../utils/handler";

const route = Router()

route.get("/:accountId", handler(NotificationController.getByAccount))
route.patch("/:accountId/read-all", handler(NotificationController.markAllAsRead))
route.patch("/:id/read", handler(NotificationController.markAsRead))

export default route