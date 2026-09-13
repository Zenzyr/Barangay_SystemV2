import DocumentRequestModel from "../model/documentRequest.model"
import { documentRequestInterface, documentRequestInterfaceInput } from "../types/documentRequest";

export class DocumentRequestService {

  /**
   * Derives the normalized duplicate-prevention stamp from a single request
   * timestamp. Server timezone is Asia/Manila (see backend/index.ts).
   * requestDate = YYYY-MM-DD, requestTime = HH:mm.
   */
  static getRequestStamp(now: Date = new Date()): { requestDate: string; requestTime: string } {
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      requestDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      requestTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  }

  /**
   * Finds an existing request that matches the normalized duplicate key
   * (resident + document type + date + time). Used for the friendly
   * duplicate dialog and for recovering an existing request on E11000 races.
   */
  static async findExistingDuplicate(
    resident: string,
    document: string,
    requestDate: string,
    requestTime: string
  ) {
    return DocumentRequestModel.findOne({
      resident,
      document,
      requestDate,
      requestTime,
    }).populate("resident", "-password");
  }

  static async create(data: documentRequestInterfaceInput) {
    return await DocumentRequestModel.create(data)
  }

  static async getAll(filter: Record<string, any> = {}) {
    const documents = DocumentRequestModel.find(filter).populate("resident", "-password").sort({ _id: -1 });
    return documents
  }

  static async get(id: string) {
    const document = DocumentRequestModel.findById(id).populate("resident", "-password");
    return document
  }

  static async delete(id: string) {
    const document = DocumentRequestModel.findByIdAndDelete(id);
    return document
  }

  /** Soft-delete / archive (kept for completed records so history is preserved). */
  static async archive(id: string) {
    return DocumentRequestModel.findByIdAndUpdate(
      id,
      { isArchived: true, archivedAt: new Date() },
      { new: true }
    ).populate("resident", "-password");
  }

  static async update(id: string, data: Partial<documentRequestInterface>) {
    return await DocumentRequestModel.findByIdAndUpdate(id, data, { new: true }).populate("resident", "-password");
  }

  static async updateStatus(id: string, status: string) {
    return await DocumentRequestModel.findByIdAndUpdate(
      id,
      { status, $push: { statusHistory: { status, at: new Date() } } },
      { new: true }
    ).populate("resident", "-password");
  }

  static async updateSnapshot(id: string, snapshot: Record<string, any>) {
    return await DocumentRequestModel.findByIdAndUpdate(
      id,
      { officialsSnapshot: snapshot },
      { new: true }
    ).populate("resident", "-password");
  }

  static async getByResident(residentId: string) {
    const documents = DocumentRequestModel.find({ resident: residentId }).populate("resident", "-password").sort({ _id: -1 });
    return documents
  }

  static async updatePayment(id: string, isPaid: boolean) {
    return await DocumentRequestModel.findByIdAndUpdate(
      id,
      { isPaid },
      { new: true }
    ).populate("resident", "-password");
  }
}
