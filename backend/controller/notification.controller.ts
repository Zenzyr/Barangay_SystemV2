import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { NotificationService } from "../services/notification.service";
import { isObjectId } from "../utils/validation";

export class NotificationController {

  static getByAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { accountId } = request.params;
      if (!isObjectId(accountId)) {
        response.status(400).send("Invalid account id");
        return;
      }
      const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 100);
      const notifications = await NotificationService.getByAccount(accountId, limit);
      const unread = await NotificationService.countUnread(accountId);
      response.send({ notifications, unread });
    } catch (error) {
      console.error("[GET NOTIFICATIONS ERROR]", error);
      response.status(500).send("Failed to fetch notifications");
    }
  }

  static markAsRead = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid notification id");
        return;
      }
      const notification = await NotificationService.markAsRead(id);
      if (!notification) {
        response.status(404).send("Notification not found");
        return;
      }
      response.send({ message: "Notification marked as read" });
    } catch (error) {
      response.status(500).send("Failed to update notification");
    }
  }

  static markAllAsRead = async (request: AuthRequest, response: Response) => {
    try {
      const { accountId } = request.params;
      if (!isObjectId(accountId)) {
        response.status(400).send("Invalid account id");
        return;
      }
      await NotificationService.markAllAsRead(accountId);
      response.send({ message: "All notifications marked as read" });
    } catch (error) {
      response.status(500).send("Failed to update notifications");
    }
  }
}