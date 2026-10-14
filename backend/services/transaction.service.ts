import mongoose from "mongoose";
import DocumentRequestModel from "../model/documentRequest.model";
import AccountModel from "../model/account.model";
import { BarangaySettingsService } from "./barangaySettings.service";
import { DocumentRequestService } from "./documentRequest.service";
import { documentDisplayName } from "../utils/documentNames";
import { withBarangayLocality } from "../utils/residentAddress";

export const REPORT_TIMEZONE = process.env.TZ || "Asia/Manila";

export type PaymentMethod = "over-the-counter" | "online";
export type PaymentStatus = "paid" | "unpaid";
export type VerificationStatus = "pending" | "verified" | "rejected";

export const VERIFICATION_STATUSES: VerificationStatus[] = ["pending", "verified", "rejected"];

export interface TransactionFilters {
  resident?: string;
  search?: string;
  from?: string;
  to?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  document?: string;
  source?: "online" | "walk-in";
  verificationStatus?: VerificationStatus;
  receipt?: "issued";
}

export interface TransactionQuery extends TransactionFilters {
  page?: number;
  limit?: number;
  sortBy?: "date" | "amount" | "resident" | "document";
  sortDir?: "asc" | "desc";
}

export interface TransactionItem {
  _id: string;
  transactionNumber: string;
  receiptNumber: string | null;
  paymentReference: string | null;
  residentId: string | null;
  residentName: string;
  residentEmail: string;
  document: string;
  documentName: string;
  requestSource: "online" | "walk-in";
  paymentMethod: PaymentMethod | null;
  paymentChannel: string | null;
  amount: number;
  amountTendered: number | null;
  changeGiven: number | null;
  paymentStatus: PaymentStatus;
  counterPaymentIntent: boolean;
  requestStatus: string;
  transactionDate: string;
  paidAt: string | null;
  requestDate: string | null;
  receiptAvailable: boolean;
  receiptVoided: boolean;
  verificationStatus: VerificationStatus | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const dateKeyInTimezone = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const shiftDateKey = (key: string, days: number): string => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export interface PaymentActor {
  id: string;
  name: string;
}

export type PaymentActionResult<T = unknown> =
  | { status: 200; doc: any; data?: T }
  | { status: 400 | 404 | 409; message: string };

const recordedPaymentScope = (): Record<string, any> => ({
  $or: [{ isPaid: true }, { paymentVerificationStatus: { $exists: true } }],
});
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const transactionBaseStages = (): any[] => [
  {
    $addFields: {
      _method: {
        $ifNull: [
          "$paymentMethod",
          {
            $cond: [
              { $eq: ["$isPaid", true] },
              { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$checkoutSessionId", ""] } }, 0] }, "online", "over-the-counter"] },
              null,
            ],
          },
        ],
      },
      _amount: { $ifNull: ["$amountPaid", { $ifNull: ["$feeAtRequest", { $ifNull: ["$price", 0] }] }] },
      _requestedAt: { $toDate: "$_id" },
      _txAt: { $ifNull: ["$paidAt", { $toDate: "$_id" }] },
      _source: { $ifNull: ["$source", "online"] },
      _verification: {
        $ifNull: ["$paymentVerificationStatus", { $cond: [{ $eq: ["$isPaid", true] }, "verified", null] }],
      },
      _txNumber: { $concat: ["REQ-", { $toUpper: { $substrCP: [{ $toString: "$_id" }, 18, 6] } }] },
    },
  },
  {
    $addFields: {
      _day: { $dateToString: { format: "%Y-%m-%d", date: "$_txAt", timezone: REPORT_TIMEZONE } },
    },
  },
  {
    $lookup: {
      from: AccountModel.collection.name,
      localField: "resident",
      foreignField: "_id",
      as: "_resident",
      pipeline: [{ $project: { name: 1, email: 1 } }],
    },
  },
  {
    $addFields: {
      _residentName: { $ifNull: [{ $arrayElemAt: ["$_resident.name", 0] }, { $ifNull: ["$fullName", ""] }] },
      _residentEmail: { $ifNull: [{ $arrayElemAt: ["$_resident.email", 0] }, ""] },
    },
  },
];

export const buildTransactionMatch = (filters: TransactionFilters): Record<string, any> => {
  const match: Record<string, any> = {};
  if (filters.paymentStatus === "paid") match.isPaid = true;
  if (filters.paymentStatus === "unpaid") match.isPaid = { $ne: true };
  if (filters.paymentMethod) match._method = filters.paymentMethod;
  if (filters.document) match.document = filters.document;
  if (filters.source) match._source = filters.source;
  if (filters.verificationStatus) match._verification = filters.verificationStatus;
  if (filters.receipt === "issued") match.receiptNumber = { $exists: true, $nin: [null, ""] };
  if (filters.from || filters.to) {
    match._day = {};
    if (filters.from) match._day.$gte = filters.from;
    if (filters.to) match._day.$lte = filters.to;
  }
  const q = filters.search?.trim();
  if (q) {
    const re = new RegExp(escapeRegex(q.slice(0, 100)), "i");
    match.$or = [
      { _residentName: re },
      { _residentEmail: re },
      { receiptNumber: re },
      { paymentReference: re },
      { _txNumber: re },
      { document: re },
    ];
  }
  return match;
};

export const baseTransactionScope = (resident?: string): Record<string, any> => {
  const scope: Record<string, any> = {
    $or: [{ isPaid: true }, { price: { $gt: 0 } }, { paymentVerificationStatus: { $exists: true } }],
  };
  if (resident) scope.resident = new mongoose.Types.ObjectId(resident);
  return scope;
};

export const toTransactionItem = (doc: any): TransactionItem => ({
  _id: String(doc._id),
  transactionNumber: doc._txNumber || `REQ-${String(doc._id).slice(-6).toUpperCase()}`,
  receiptNumber: doc.receiptNumber || null,
  paymentReference: doc.paymentReference || null,
  residentId: doc.resident ? String(doc.resident) : null,
  residentName: doc._residentName || doc.fullName || "Unknown",
  residentEmail: doc._residentEmail || "",
  document: doc.document,
  documentName: documentDisplayName(doc.document),
  requestSource: doc._source === "walk-in" ? "walk-in" : "online",
  paymentMethod: doc._method || null,
  paymentChannel: doc.paymentChannel || (doc.isPaid ? (doc._method === "online" ? "paymongo" : "cash") : null),
  amount: Number(doc._amount) || 0,
  amountTendered: typeof doc.amountTendered === "number" ? doc.amountTendered : null,
  changeGiven: typeof doc.changeGiven === "number" ? doc.changeGiven : null,
  paymentStatus: doc.isPaid ? "paid" : "unpaid",
  counterPaymentIntent: doc.counterPaymentIntent === true,
  requestStatus: doc.status,
  transactionDate: new Date(doc._txAt).toISOString(),
  paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : null,
  requestDate: doc.requestDate || null,
  receiptAvailable: !!doc.isPaid,
  receiptVoided: !doc.isPaid && doc._verification === "rejected" && !!doc.receiptNumber,
  verificationStatus: doc._verification || null,
  verifiedAt: doc.paymentVerifiedAt ? new Date(doc.paymentVerifiedAt).toISOString() : null,
  rejectedAt: doc.paymentRejectedAt ? new Date(doc.paymentRejectedAt).toISOString() : null,
  rejectionReason: doc.paymentRejectionReason || null,
});

export const parseTransactionFilters = (query: Record<string, any>): TransactionFilters => {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const filters: TransactionFilters = {};
  if (str(query.search)) filters.search = str(query.search).slice(0, 100);
  if (DATE_RE.test(str(query.from))) filters.from = str(query.from);
  if (DATE_RE.test(str(query.to))) filters.to = str(query.to);
  if (query.paymentMethod === "over-the-counter" || query.paymentMethod === "online") filters.paymentMethod = query.paymentMethod;
  if (query.paymentStatus === "paid" || query.paymentStatus === "unpaid") filters.paymentStatus = query.paymentStatus;
  if (/^[A-Za-z]{1,60}$/.test(str(query.document))) filters.document = str(query.document);
  if (query.source === "online" || query.source === "walk-in") filters.source = query.source;
  if (VERIFICATION_STATUSES.includes(query.verificationStatus)) filters.verificationStatus = query.verificationStatus;
  if (query.receipt === "issued") filters.receipt = "issued";
  if (mongoose.isValidObjectId(str(query.resident)) && /^[a-f0-9]{24}$/i.test(str(query.resident))) filters.resident = str(query.resident);
  return filters;
};

export const validateDateRange = (filters: { from?: string; to?: string }): string | null => {
  if (filters.from && filters.to && filters.from > filters.to) return "The start date must be on or before the end date";
  return null;
};

const SORT_FIELDS: Record<string, string> = {
  date: "_txAt",
  amount: "_amount",
  resident: "_residentName",
  document: "document",
};

export class TransactionService {

  static async list(query: TransactionQuery) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 20)));
    const sortField = SORT_FIELDS[query.sortBy || "date"] || "_txAt";
    const sortDir = query.sortDir === "asc" ? 1 : -1;

    const [result] = await DocumentRequestModel.aggregate([
      { $match: baseTransactionScope(query.resident) },
      ...transactionBaseStages(),
      { $match: buildTransactionMatch(query) },
      {
        $facet: {
          items: [
            { $sort: { [sortField]: sortDir, _id: sortDir } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ],
          totals: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                paidCount: { $sum: { $cond: [{ $eq: ["$isPaid", true] }, 1, 0] } },
                paidAmount: { $sum: { $cond: [{ $eq: ["$isPaid", true] }, "$_amount", 0] } },
                unpaidAmount: { $sum: { $cond: [{ $eq: ["$isPaid", true] }, 0, "$_amount"] } },
              },
            },
          ],
        },
      },
    ]);

    const totals = result?.totals?.[0] ?? {
      count: 0,
      paidCount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
    };
    return {
      items: (result?.items ?? []).map(toTransactionItem),
      total: totals.count,
      page,
      limit,
      pages: Math.max(1, Math.ceil(totals.count / limit)),
      summary: {
        paidCount: totals.paidCount,
        unpaidCount: totals.count - totals.paidCount,
        paidAmount: totals.paidAmount,
        unpaidAmount: totals.unpaidAmount,
      },
    };
  }

  static async getReceipt(
    id: string,
    authorize: (ownerId: string | null) => boolean,
    options: { allowVoided?: boolean } = {},
  ) {
    let doc: any = await DocumentRequestModel.findById(id).populate("resident", "name email contact address purok").lean();
    if (!doc) return { status: 404 as const };
    const ownerId = doc.resident?._id ? String(doc.resident._id) : doc.resident ? String(doc.resident) : null;
    if (!authorize(ownerId)) return { status: 403 as const };
    const voided = !doc.isPaid && doc.paymentVerificationStatus === "rejected" && !!doc.receiptNumber;
    if (!doc.isPaid && !(voided && options.allowVoided)) return { status: 400 as const };

    if (doc.isPaid && !doc.receiptNumber) {
      const inferredMethod = doc.paymentMethod || (doc.checkoutSessionId ? "online" : "over-the-counter");
      await DocumentRequestModel.updateOne(
        { _id: id, isPaid: true, receiptNumber: { $exists: false } },
        {
          $set: {
            receiptNumber: DocumentRequestService.buildReceiptNumber(String(doc._id), doc.paidAt ? new Date(doc.paidAt) : new Date()),
            paymentMethod: inferredMethod,
            paymentChannel: doc.paymentChannel || (inferredMethod === "online" ? "paymongo" : "cash"),
            amountPaid: typeof doc.amountPaid === "number" ? doc.amountPaid : Number(doc.feeAtRequest ?? doc.price) || 0,
          },
        },
      );
      doc = await DocumentRequestModel.findById(id).populate("resident", "name email contact address purok").lean();
    }

    const settings: any = await BarangaySettingsService.get();
    const info = settings?.barangay ?? {};
    const locality = [info.municipality, info.province].filter(Boolean).join(", ");

    let processedBy: string | null = null;
    if (doc.paymentProcessedBy) {
      const staff: any = await AccountModel.findById(doc.paymentProcessedBy).select("name").lean();
      processedBy = staff?.name || null;
    }

    const resident: any = doc.resident && typeof doc.resident === "object" ? doc.resident : null;
    const amount = typeof doc.amountPaid === "number" ? doc.amountPaid : Number(doc.feeAtRequest ?? doc.price) || 0;

    return {
      status: 200 as const,
      receipt: {
        requestId: String(doc._id),
        residentId: resident?._id ? String(resident._id) : null,
        receiptNumber: doc.receiptNumber,
        paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : null,
        paymentMethod: doc.paymentMethod as PaymentMethod,
        paymentChannel: doc.paymentChannel || null,
        paymentReference: doc.paymentReference || null,
        requestSource: doc.source === "walk-in" ? "walk-in" : "online",
        amount,
        amountTendered: typeof doc.amountTendered === "number" ? doc.amountTendered : null,
        changeGiven: typeof doc.changeGiven === "number" ? doc.changeGiven : null,
        processedBy,
        payer: {
          name: resident?.name || doc.fullName || "N/A",
          address: withBarangayLocality(resident?.address || doc.address, info),
          contact: resident?.contact || doc.contact || "",
        },
        item: {
          document: doc.document,
          documentName: documentDisplayName(doc.document),
          documentNumber: doc.documentNumber || null,
        },
        requestStatus: doc.status,
        verificationStatus: (doc.paymentVerificationStatus || "verified") as VerificationStatus,
        verifiedAt: doc.paymentVerifiedAt ? new Date(doc.paymentVerifiedAt).toISOString() : null,
        voided,
        rejectionReason: voided ? doc.paymentRejectionReason || null : null,
        barangay: {
          name: info.name || "Barangay",
          address: [info.address, locality].filter(Boolean).join(", "),
          contactNumber: info.contactNumber || "",
          email: info.email || "",
          logoUrl: info.logoUrl || "",
        },
      },
    };
  }

  static async residentOptions() {
    const rows = await DocumentRequestModel.aggregate([
      { $match: { ...baseTransactionScope(), resident: { $type: "objectId" } } },
      { $group: { _id: "$resident" } },
      {
        $lookup: {
          from: AccountModel.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "account",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: "$account" },
      { $project: { _id: 1, name: "$account.name" } },
      { $sort: { name: 1 } },
    ]);
    return rows.map((r: any) => ({ _id: String(r._id), name: r.name || "Unknown" }));
  }

  static async dashboard(now: Date = new Date()) {
    const today = dateKeyInTimezone(now);
    const monthStart = `${today.slice(0, 7)}-01`;
    const weekStart = shiftDateKey(today, -6);
    const isToday = { $eq: ["$_day", today] };

    const [result] = await DocumentRequestModel.aggregate([
      { $match: recordedPaymentScope() },
      ...transactionBaseStages(),
      { $match: { _verification: { $ne: "rejected" } } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                todayCollected: { $sum: { $cond: [isToday, "$_amount", 0] } },
                todayTransactions: { $sum: { $cond: [isToday, 1, 0] } },
                totalCollected: { $sum: "$_amount" },
                totalCount: { $sum: 1 },
                monthCollected: {
                  $sum: { $cond: [{ $and: [{ $gte: ["$_day", monthStart] }, { $lte: ["$_day", today] }] }, "$_amount", 0] },
                },
                cashCollected: {
                  $sum: { $cond: [{ $eq: ["$_method", "over-the-counter"] }, "$_amount", 0] },
                },
                onlineCollected: {
                  $sum: { $cond: [{ $eq: ["$_method", "online"] }, "$_amount", 0] },
                },
              },
            },
          ],
          lastSevenDays: [
            { $match: { _day: { $gte: weekStart, $lte: today } } },
            {
              $group: {
                _id: "$_day",
                collected: { $sum: "$_amount" },
                transactions: { $sum: 1 },
              },
            },
          ],
          recent: [{ $sort: { _txAt: -1, _id: -1 } }, { $limit: 5 }],
        },
      },
    ]);

    const t = result?.totals?.[0] ?? {};
    const byDay = new Map<string, any>((result?.lastSevenDays ?? []).map((d: any) => [d._id, d]));
    const series = Array.from({ length: 7 }, (_, i) => {
      const day = shiftDateKey(weekStart, i);
      const row = byDay.get(day);
      return {
        day,
        collected: round2(row?.collected ?? 0),
        transactions: row?.transactions ?? 0,
      };
    });

    return {
      date: today,
      timeZone: REPORT_TIMEZONE,
      today: {
        collected: round2(t.todayCollected),
        transactions: t.todayTransactions ?? 0,
      },
      totals: {
        collected: round2(t.totalCollected),
        count: t.totalCount ?? 0,
        monthCollected: round2(t.monthCollected),
        cashCollected: round2(t.cashCollected),
        onlineCollected: round2(t.onlineCollected),
      },
      lastSevenDays: series,
      recent: (result?.recent ?? []).map(toTransactionItem),
    };
  }

  static async getDetail(id: string) {
    const [doc] = await DocumentRequestModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      ...transactionBaseStages(),
      {
        $lookup: {
          from: AccountModel.collection.name,
          let: { ids: { $setUnion: [[{ $ifNull: ["$paymentProcessedBy", null] }, { $ifNull: ["$paymentVerifiedBy", null] }, { $ifNull: ["$paymentRejectedBy", null] }]] } },
          pipeline: [{ $match: { $expr: { $in: ["$_id", "$$ids"] } } }, { $project: { name: 1 } }],
          as: "_staff",
        },
      },
      {
        $lookup: {
          from: AccountModel.collection.name,
          localField: "resident",
          foreignField: "_id",
          as: "_residentFull",
          pipeline: [{ $project: { contact: 1, address: 1, purok: 1 } }],
        },
      },
    ]);
    if (!doc) return null;

    const staffName = (value: unknown) => {
      if (!value) return null;
      const match = (doc._staff ?? []).find((a: any) => String(a._id) === String(value));
      return match?.name || null;
    };
    const residentFull = doc._residentFull?.[0] ?? {};
    const detailSettings = await BarangaySettingsService.get().catch(() => null);
    const detailBarangay = ((detailSettings as any)?.barangay as any) || {};

    return {
      ...toTransactionItem(doc),
      residentContact: residentFull.contact || doc.contact || "",
      residentAddress: withBarangayLocality(residentFull.address || doc.address, detailBarangay),
      residentPurok: residentFull.purok || doc.purok || "",
      purpose: doc.purpose || null,
      documentNumber: doc.documentNumber || null,
      processedBy: staffName(doc.paymentProcessedBy),
      verifiedBy: staffName(doc.paymentVerifiedBy),
      rejectedBy: staffName(doc.paymentRejectedBy),
      history: (doc.paymentHistory ?? [])
        .map((h: any) => ({
          action: h.action,
          at: h.at ? new Date(h.at).toISOString() : null,
          byName: h.byName || null,
          note: h.note || null,
          changes: h.changes || null,
          receiptNumber: h.snapshot?.receiptNumber || null,
          amount: typeof h.snapshot?.amountPaid === "number" ? h.snapshot.amountPaid : null,
          paymentMethod: h.snapshot?.paymentMethod || null,
          paymentChannel: h.snapshot?.paymentChannel || null,
          paymentReference: h.snapshot?.paymentReference || null,
        }))
        .sort((a: any, b: any) => String(b.at).localeCompare(String(a.at))),
    };
  }

  static async logReceiptReprint(id: string, actor: PaymentActor): Promise<PaymentActionResult> {
    const doc = await DocumentRequestModel.findOneAndUpdate(
      { _id: id, receiptNumber: { $exists: true, $nin: [null, ""] } },
      { $push: { paymentHistory: { action: "receipt_reprinted", at: new Date(), by: actor.id, byName: actor.name } } },
      { new: true },
    );
    if (!doc) return { status: 404, message: "Receipt not found" };
    return { status: 200, doc };
  }
}
