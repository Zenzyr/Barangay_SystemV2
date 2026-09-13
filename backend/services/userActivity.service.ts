import UserActivityModel from "../model/userActivity"
import { userActivityInterface, userActivityInterfaceInput } from "../types/userActivity";

export class UserActivityService {

  static async create(data: userActivityInterfaceInput) {
    return await UserActivityModel.create(data)
  }

  static async getAll(filter: Record<string, any> = {}) {
    const activities = UserActivityModel.find(filter);
    return activities
  }

  static async get(id: string) {
    const activity = UserActivityModel.findById(id);
    return activity
  }

  static async delete(id: string) {
    const activity = UserActivityModel.findByIdAndDelete(id);
    return activity
  }

  static async update(id: string, data: Partial<userActivityInterface>) {
    return await UserActivityModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async getByAccount(accountId: string) {
    const activities = UserActivityModel.find({ accountId }).sort({ _id: -1 });;
    return activities
  }
}
