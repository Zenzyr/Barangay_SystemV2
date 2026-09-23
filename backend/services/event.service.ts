import EventModel from "../model/event.model";
import { eventInterfaceInput } from "../types/event.type";

export class EventService {

  static async getAll(filter: Record<string, any> = {}) {
    return EventModel.find(filter).populate("createdBy", "-password").sort({ date: 1, _id: -1 });
  }

  static async get(id: string) {
    return EventModel.findById(id).populate("createdBy", "-password");
  }

  static async create(data: eventInterfaceInput) {
    return EventModel.create(data);
  }

  static async update(id: string, data: Partial<eventInterfaceInput>) {
    return EventModel.findByIdAndUpdate(id, data, { new: true }).populate("createdBy", "-password");
  }

  /** Soft-delete / archive so past event history is preserved. */
  static async archive(id: string) {
    return EventModel.findByIdAndUpdate(
      id,
      { isArchived: true, archivedAt: new Date() },
      { new: true }
    ).populate("createdBy", "-password");
  }

  static async delete(id: string) {
    return EventModel.findByIdAndDelete(id);
  }
}