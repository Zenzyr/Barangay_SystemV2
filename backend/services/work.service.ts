import WorkModel from "../model/work.model"
import { workInterface, workInterfaceInput } from "../types/work.type";

export class WorkService {

  static async create(data: workInterfaceInput) {
    return await WorkModel.create(data)
  }

  static async getAll(filter: Record<string, any> = {}) {
    const works = WorkModel.find(filter).populate("client", "-password").populate("worker", "-password").sort({ _id: -1 });
    return works
  }

  static async get(id: string) {
    const work = WorkModel.findById(id).populate("client", "-password").populate("worker", "-password");
    return work
  }

  static async delete(id: string) {
    const work = WorkModel.findByIdAndDelete(id);
    return work
  }

  static async update(id: string, data: Partial<workInterface>) {
    return await WorkModel.findByIdAndUpdate(id, data, { new: true }).populate("client", "-password").populate("worker", "-password");
  }

  static async updateStatus(id: string, status: string) {
    return await WorkModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate("client", "-password").populate("worker", "-password");
  }

  static async getByClient(clientId: string) {
    const works = WorkModel.find({ client: clientId }).populate("client", "-password").populate("worker", "-password").sort({ _id: -1 });
    return works
  }

  static async getByWorker(workerId: string) {
    const works = WorkModel.find({ worker: workerId }).populate("client", "-password").populate("worker", "-password").sort({ _id: -1 });
    return works
  }
}
