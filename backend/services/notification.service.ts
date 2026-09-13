import NotificationModel from "../model/notification.model";
import { notificationInterfaceInput } from "../types/notification";

export class NotificationService {

  static async create(data: notificationInterfaceInput) {
    return await NotificationModel.create(data);
  }

  static async getByAccount(accountId: string, limit = 20) {
    return await NotificationModel.find({ accountId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  static async countUnread(accountId: string) {
    return await NotificationModel.countDocuments({ accountId, read: false });
  }

  static async markAsRead(id: string) {
    return await NotificationModel.findByIdAndUpdate(id, { read: true }, { new: true });
  }

  static async markAllAsRead(accountId: string) {
    return await NotificationModel.updateMany({ accountId, read: false }, { read: true });
  }
}