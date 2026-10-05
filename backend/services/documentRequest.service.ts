import DocumentRequestModel from "../model/documentRequest.model"
import { documentRequestInterface, documentRequestInterfaceInput } from "../types/documentRequest";

export const BUSINESS_TIME_ZONE = "Asia/Manila";
export const BUSINESS_UTC_OFFSET = "+08:00";
export const DAILY_DOCUMENT_REQUEST_LIMIT = 1;
export const DAILY_LIMIT_EXCLUDED_STATUSES = ["cancelled", "rejected"];

const businessParts = (now: Date): Record<string, string> => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
};

export interface DailyRequestStatus {
  limit: number;
  used: number;
  remaining: number;
  limitReached: boolean;
  date: string;
  nextAvailableDate: string;
  resetsAt: string;
  timeZone: string;
}

export class DocumentRequestService {

  /**
   * Derives the normalized duplicate-prevention stamp from a single request
   * timestamp. Server timezone is Asia/Manila (see backend/index.ts).
   * requestDate = YYYY-MM-DD, requestTime = HH:mm.
   */
  static getRequestStamp(now: Date = new Date()): { requestDate: string; requestTime: string } {
    const p = businessParts(now);
    return {
      requestDate: `${p.year}-${p.month}-${p.day}`,
      requestTime: `${p.hour}:${p.minute}`,
    };
  }

  static nextBusinessDate(dateKey: string): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return next.toISOString().slice(0, 10);
  }

  static dailyLimitFilter(residentId: string, requestDate: string) {
    return {
      resident: residentId,
      requestDate,
      source: { $ne: "walk-in" },
      status: { $nin: DAILY_LIMIT_EXCLUDED_STATUSES },
    };
  }

  static async getDailyStatus(residentId: string, now: Date = new Date()): Promise<DailyRequestStatus> {
    const { requestDate } = DocumentRequestService.getRequestStamp(now);
    const used = await DocumentRequestModel.countDocuments(
      DocumentRequestService.dailyLimitFilter(residentId, requestDate),
    );
    const tomorrow = DocumentRequestService.nextBusinessDate(requestDate);
    const limitReached = used >= DAILY_DOCUMENT_REQUEST_LIMIT;
    return {
      limit: DAILY_DOCUMENT_REQUEST_LIMIT,
      used,
      remaining: Math.max(0, DAILY_DOCUMENT_REQUEST_LIMIT - used),
      limitReached,
      date: requestDate,
      nextAvailableDate: limitReached ? tomorrow : requestDate,
      resetsAt: `${tomorrow}T00:00:00${BUSINESS_UTC_OFFSET}`,
      timeZone: BUSINESS_TIME_ZONE,
    };
  }

  static async isWithinDailyLimit(residentId: string, requestDate: string, documentId: string): Promise<boolean> {
    const earliest = await DocumentRequestModel.find(
      DocumentRequestService.dailyLimitFilter(residentId, requestDate),
    )
      .sort({ _id: 1 })
      .limit(DAILY_DOCUMENT_REQUEST_LIMIT)
      .select("_id")
      .lean();
    return earliest.some((d) => String(d._id) === String(documentId));
  }

  /**
   * Finds an existing request that matches the normalized duplicate key
   * (resident + document type + date + time — or the denormalized fullName
   * for walk-ins without a linked account). Used for the friendly duplicate
   * dialog and for recovering an existing request on E11000 races.
   */
  static async findExistingDuplicate(
    resident: string | null | undefined,
    document: string,
    requestDate: string,
    requestTime: string,
    fullName?: string | null
  ) {
    const filter: Record<string, any> = { document, requestDate, requestTime };
    if (resident) filter.resident = resident;
    else if (fullName && String(fullName).trim()) filter.fullName = String(fullName).trim();
    return DocumentRequestModel.findOne(filter).populate("resident", "-password");
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

  static buildReceiptNumber(id: string, paidAt: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${paidAt.getFullYear()}${pad(paidAt.getMonth() + 1)}${pad(paidAt.getDate())}`;
    return `BRGY-${stamp}-${String(id).slice(-6).toUpperCase()}`;
  }

  static async recordPayment(
    id: string,
    details: {
      paymentMethod: "over-the-counter" | "online";
      paymentChannel: string;
      amountPaid: number;
      amountTendered?: number;
      changeGiven?: number;
      paidAt?: Date;
      paymentReference?: string;
      paymentProcessedBy?: string;
    }
  ) {
    const paidAt = details.paidAt ?? new Date();
    const set: Record<string, any> = {
      isPaid: true,
      paymentMethod: details.paymentMethod,
      paymentChannel: details.paymentChannel,
      amountPaid: details.amountPaid,
      paidAt,
      receiptNumber: DocumentRequestService.buildReceiptNumber(id, paidAt),
    };
    if (details.amountTendered !== undefined) set.amountTendered = details.amountTendered;
    if (details.changeGiven !== undefined) set.changeGiven = details.changeGiven;
    if (details.paymentReference) set.paymentReference = details.paymentReference;
    if (details.paymentProcessedBy) set.paymentProcessedBy = details.paymentProcessedBy;

    return await DocumentRequestModel.findOneAndUpdate(
      { _id: id, isPaid: { $ne: true } },
      { $set: set },
      { new: true }
    ).populate("resident", "-password");
  }

  static async clearPayment(id: string) {
    return await DocumentRequestModel.findByIdAndUpdate(
      id,
      {
        $set: { isPaid: false },
        $unset: {
          paymentMethod: 1,
          paymentChannel: 1,
          amountPaid: 1,
          amountTendered: 1,
          changeGiven: 1,
          paidAt: 1,
          receiptNumber: 1,
          paymentReference: 1,
          paymentProcessedBy: 1,
        },
      },
      { new: true }
    ).populate("resident", "-password");
  }
}
