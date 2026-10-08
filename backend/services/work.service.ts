import WorkModel from "../model/work.model"
import { workInterface, workInterfaceInput } from "../types/work.type";

// Only public party fields are projected so a resident can never read the
// counterparty's private account data (ID images, reset hashes, flags, ...).
const PARTY_FIELDS = "name profile email contact address purok";

export class WorkService {

  static async create(data: workInterfaceInput) {
    return await WorkModel.create(data)
  }

  static async getAll(filter: Record<string, any> = {}) {
    const works = WorkModel.find(filter).populate("client", PARTY_FIELDS).populate("worker", PARTY_FIELDS).sort({ _id: -1 });
    return works
  }

  static async get(id: string) {
    const work = WorkModel.findById(id).populate("client", PARTY_FIELDS).populate("worker", PARTY_FIELDS);
    return work
  }

  static async delete(id: string) {
    const work = WorkModel.findByIdAndDelete(id);
    return work
  }

  static async update(id: string, data: Partial<workInterface>) {
    return await WorkModel.findByIdAndUpdate(id, data, { new: true }).populate("client", PARTY_FIELDS).populate("worker", PARTY_FIELDS);
  }

  static async updateStatus(id: string, status: string) {
    return await WorkModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate("client", PARTY_FIELDS).populate("worker", PARTY_FIELDS);
  }

  static async updateStatusIf(id: string, currentStatus: string, status: string) {
    return await WorkModel.findOneAndUpdate(
      { _id: id, status: currentStatus },
      { status },
      { new: true }
    ).populate("client", PARTY_FIELDS).populate("worker", PARTY_FIELDS);
  }
}
