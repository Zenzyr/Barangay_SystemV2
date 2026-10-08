import mongoose from "mongoose";
import DocumentRequestModel from "../model/documentRequest.model";
import AccountModel from "../model/account.model";
import { BarangaySettingsService } from "./barangaySettings.service";
import { DocumentRequestService, paymentSnapshot } from "./documentRequest.service";
import { documentDisplayName } from "../utils/documentNames";

export const REPORT_TIMEZONE = process.env.TZ || "Asia/Manila";

export type PaymentMethod = "over-the-counter" | "online";
export type PaymentStatus = "paid" | "unpaid";
export type VerificationStatus = "pending" | "verified" | "rejected";

export const VERIFICATION_STATUSES: VerificationStatus[] = ["pending", "verified", "rejected"];
export const ONLINE_PAYMENT_CHANNELS = ["paymongo", "gcash", "paymaya", "grab_pay", "card", "dob", "qrph", "billease"];
export const OVER_THE_COUNTER_CHANNELS = ["cash"];
export const MAX_TENDERED_AMOUNT = 100000;

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
                verifiedCount: { $sum: { $cond: [{ $eq: ["$_verification", "verified"] }, 1, 0] } },
                verifiedAmount: { $sum: { $cond: [{ $eq: ["$_verification", "verified"] }, "$_amount", 0] } },
                pendingVerificationCount: { $sum: { $cond: [{ $eq: ["$_verification", "pending"] }, 1, 0] } },
                pendingVerificationAmount: { $sum: { $cond: [{ $eq: ["$_verification", "pending"] }, "$_amount", 0] } },
                rejectedCount: { $sum: { $cond: [{ $eq: ["$_verification", "rejected"] }, 1, 0] } },
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
      verifiedCount: 0,
      verifiedAmount: 0,
      pendingVerificationCount: 0,
      pendingVerificationAmount: 0,
      rejectedCount: 0,
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
        verifiedCount: totals.verifiedCount,
        verifiedAmount: round2(totals.verifiedAmount),
        pendingVerificationCount: totals.pendingVerificationCount,
        pendingVerificationAmount: round2(totals.pendingVerificationAmount),
        rejectedCount: totals.rejectedCount,
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
          address: resident?.address || doc.address || "",
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
    const isVerified = { $eq: ["$_verification", "verified"] };
    const isPending = { $eq: ["$_verification", "pending"] };
    const isToday = { $eq: ["$_day", today] };

    const [result] = await DocumentRequestModel.aggregate([
      { $match: recordedPaymentScope() },
      ...transactionBaseStages(),
      { $match: { _verification: { $in: VERIFICATION_STATUSES } } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                todayCollected: { $sum: { $cond: [{ $and: [isToday, isVerified] }, "$_amount", 0] } },
                todayVerifiedCount: { $sum: { $cond: [{ $and: [isToday, isVerified] }, 1, 0] } },
                todayPendingAmount: { $sum: { $cond: [{ $and: [isToday, isPending] }, "$_amount", 0] } },
                todayTransactions: { $sum: { $cond: [isToday, 1, 0] } },
                pendingCount: { $sum: { $cond: [isPending, 1, 0] } },
                pendingAmount: { $sum: { $cond: [isPending, "$_amount", 0] } },
                totalCollected: { $sum: { $cond: [isVerified, "$_amount", 0] } },
                totalVerifiedCount: { $sum: { $cond: [isVerified, 1, 0] } },
                monthCollected: {
                  $sum: { $cond: [{ $and: [isVerified, { $gte: ["$_day", monthStart] }, { $lte: ["$_day", today] }] }, "$_amount", 0] },
                },
                cashCollected: {
                  $sum: { $cond: [{ $and: [isVerified, { $eq: ["$_method", "over-the-counter"] }] }, "$_amount", 0] },
                },
                onlineCollected: {
                  $sum: { $cond: [{ $and: [isVerified, { $eq: ["$_method", "online"] }] }, "$_amount", 0] },
                },
                rejectedCount: { $sum: { $cond: [{ $eq: ["$_verification", "rejected"] }, 1, 0] } },
              },
            },
          ],
          lastSevenDays: [
            { $match: { _day: { $gte: weekStart, $lte: today } } },
            {
              $group: {
                _id: "$_day",
                collected: { $sum: { $cond: [isVerified, "$_amount", 0] } },
                pending: { $sum: { $cond: [isPending, "$_amount", 0] } },
                transactions: { $sum: 1 },
              },
            },
          ],
          oldestPending: [
            { $match: { _verification: "pending" } },
            { $sort: { _txAt: 1, _id: 1 } },
            { $limit: 5 },
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
        pending: round2(row?.pending ?? 0),
        transactions: row?.transactions ?? 0,
      };
    });

    return {
      date: today,
      timeZone: REPORT_TIMEZONE,
      today: {
        collected: round2(t.todayCollected),
        verifiedCount: t.todayVerifiedCount ?? 0,
        pendingAmount: round2(t.todayPendingAmount),
        transactions: t.todayTransactions ?? 0,
      },
      pendingVerification: {
        count: t.pendingCount ?? 0,
        amount: round2(t.pendingAmount),
      },
      totals: {
        collected: round2(t.totalCollected),
        verifiedCount: t.totalVerifiedCount ?? 0,
        monthCollected: round2(t.monthCollected),
        cashCollected: round2(t.cashCollected),
        onlineCollected: round2(t.onlineCollected),
        rejectedCount: t.rejectedCount ?? 0,
      },
      lastSevenDays: series,
      oldestPending: (result?.oldestPending ?? []).map(toTransactionItem),
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

    return {
      ...toTransactionItem(doc),
      residentContact: residentFull.contact || doc.contact || "",
      residentAddress: residentFull.address || doc.address || "",
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

  static async verify(id: string, actor: PaymentActor, note?: string): Promise<PaymentActionResult> {
    const current: any = await DocumentRequestModel.findById(id).lean();
    if (!current) return { status: 404, message: "Transaction not found" };
    if (!current.isPaid || current.paymentVerificationStatus !== "pending") {
      return { status: 409, message: "Only payments awaiting verification can be verified" };
    }
    const at = new Date();
    const doc = await DocumentRequestModel.findOneAndUpdate(
      { _id: id, isPaid: true, paymentVerificationStatus: "pending" },
      {
        $set: { paymentVerificationStatus: "verified", paymentVerifiedBy: actor.id, paymentVerifiedAt: at },
        $push: {
          paymentHistory: { action: "verified", at, by: actor.id, byName: actor.name, note: note || undefined, snapshot: paymentSnapshot(current) },
        },
      },
      { new: true },
    ).populate("resident", "-password");
    if (!doc) return { status: 409, message: "This payment was already reviewed" };
    return { status: 200, doc };
  }

  static async reject(id: string, actor: PaymentActor, reason: string): Promise<PaymentActionResult> {
    const current: any = await DocumentRequestModel.findById(id).lean();
    if (!current) return { status: 404, message: "Transaction not found" };
    if (!current.isPaid || current.paymentVerificationStatus !== "pending") {
      return { status: 409, message: "Only payments awaiting verification can be rejected" };
    }
    const at = new Date();
    const doc = await DocumentRequestModel.findOneAndUpdate(
      { _id: id, isPaid: true, paymentVerificationStatus: "pending" },
      {
        $set: {
          isPaid: false,
          paymentVerificationStatus: "rejected",
          paymentRejectedBy: actor.id,
          paymentRejectedAt: at,
          paymentRejectionReason: reason,
        },
        $unset: { checkoutSessionId: 1 },
        $push: {
          paymentHistory: { action: "rejected", at, by: actor.id, byName: actor.name, note: reason, snapshot: paymentSnapshot(current) },
        },
      },
      { new: true },
    ).populate("resident", "-password");
    if (!doc) return { status: 409, message: "This payment was already reviewed" };
    return { status: 200, doc };
  }

  static async correct(
    id: string,
    actor: PaymentActor,
    input: { paymentReference?: unknown; paymentChannel?: unknown; amountTendered?: unknown; reason: string },
  ): Promise<PaymentActionResult<Record<string, { from: unknown; to: unknown }>>> {
    const current: any = await DocumentRequestModel.findById(id).lean();
    if (!current) return { status: 404, message: "Transaction not found" };
    if (!current.isPaid || current.paymentVerificationStatus !== "pending") {
      return { status: 409, message: "Only payments awaiting verification can be corrected" };
    }

    const set: Record<string, any> = {};
    const unset: Record<string, 1> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (input.paymentReference !== undefined) {
      if (input.paymentReference !== null && typeof input.paymentReference !== "string") {
        return { status: 400, message: "Payment reference must be text" };
      }
      const next = String(input.paymentReference ?? "").trim();
      if (next.length > 100 || (next && !/^[A-Za-z0-9 _\-./#:]+$/.test(next))) {
        return { status: 400, message: "Payment reference may only contain letters, numbers, spaces, and - _ . / # :" };
      }
      if (next !== (current.paymentReference || "")) {
        if (next) set.paymentReference = next;
        else unset.paymentReference = 1;
        changes.paymentReference = { from: current.paymentReference || null, to: next || null };
      }
    }

    if (input.paymentChannel !== undefined) {
      const next = String(input.paymentChannel ?? "").trim().toLowerCase();
      const allowed = current.paymentMethod === "online" ? ONLINE_PAYMENT_CHANNELS : OVER_THE_COUNTER_CHANNELS;
      if (!allowed.includes(next)) {
        return { status: 400, message: `Payment channel must be one of: ${allowed.join(", ")}` };
      }
      if (next !== current.paymentChannel) {
        set.paymentChannel = next;
        changes.paymentChannel = { from: current.paymentChannel || null, to: next };
      }
    }

    if (input.amountTendered !== undefined) {
      if (current.paymentMethod !== "over-the-counter") {
        return { status: 400, message: "Amount tendered applies to over-the-counter payments only" };
      }
      const tendered = Number(input.amountTendered);
      const due = Number(current.amountPaid) || 0;
      if (input.amountTendered === null || input.amountTendered === "" || !Number.isFinite(tendered) || tendered < 0) {
        return { status: 400, message: "Amount tendered must be a valid amount" };
      }
      if (tendered > MAX_TENDERED_AMOUNT) {
        return { status: 400, message: `Amount tendered cannot exceed ${MAX_TENDERED_AMOUNT}` };
      }
      if (tendered < due) return { status: 400, message: "Amount tendered is less than the amount due" };
      const rounded = round2(tendered);
      if (rounded !== current.amountTendered) {
        set.amountTendered = rounded;
        set.changeGiven = round2(rounded - due);
        changes.amountTendered = { from: current.amountTendered ?? null, to: rounded };
        changes.changeGiven = { from: current.changeGiven ?? null, to: set.changeGiven };
      }
    }

    if (Object.keys(changes).length === 0) return { status: 400, message: "No changes to apply" };

    const update: Record<string, any> = {
      $set: set,
      $push: {
        paymentHistory: { action: "corrected", at: new Date(), by: actor.id, byName: actor.name, note: input.reason, changes, snapshot: paymentSnapshot(current) },
      },
    };
    if (Object.keys(unset).length) update.$unset = unset;

    const doc = await DocumentRequestModel.findOneAndUpdate(
      { _id: id, isPaid: true, paymentVerificationStatus: "pending" },
      update,
      { new: true },
    );
    if (!doc) return { status: 409, message: "This payment was already reviewed" };
    return { status: 200, doc, data: changes };
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
