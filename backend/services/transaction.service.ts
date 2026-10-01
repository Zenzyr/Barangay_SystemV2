import mongoose from "mongoose";
import DocumentRequestModel from "../model/documentRequest.model";
import AccountModel from "../model/account.model";
import { BarangaySettingsService } from "./barangaySettings.service";
import { DocumentRequestService } from "./documentRequest.service";
import { documentDisplayName } from "../utils/documentNames";

export const REPORT_TIMEZONE = process.env.TZ || "Asia/Manila";

export type PaymentMethod = "over-the-counter" | "online";
export type PaymentStatus = "paid" | "unpaid";

export interface TransactionFilters {
  resident?: string;
  search?: string;
  from?: string;
  to?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  document?: string;
  source?: "online" | "walk-in";
}

export interface TransactionQuery extends TransactionFilters {
  page?: number;
  limit?: number;
  sortBy?: "date" | "amount" | "resident" | "document";
  sortDir?: "asc" | "desc";
}

export interface TransactionItem {
  _id: string;
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
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
      { document: re },
    ];
  }
  return match;
};

export const baseTransactionScope = (resident?: string): Record<string, any> => {
  const scope: Record<string, any> = {
    $or: [{ isPaid: true }, { price: { $gt: 0 } }],
  };
  if (resident) scope.resident = new mongoose.Types.ObjectId(resident);
  return scope;
};

export const toTransactionItem = (doc: any): TransactionItem => ({
  _id: String(doc._id),
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

    const totals = result?.totals?.[0] ?? { count: 0, paidCount: 0, paidAmount: 0, unpaidAmount: 0 };
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

  static async getReceipt(id: string, authorize: (ownerId: string | null) => boolean) {
    let doc: any = await DocumentRequestModel.findById(id).populate("resident", "name email contact address purok").lean();
    if (!doc) return { status: 404 as const };
    const ownerId = doc.resident?._id ? String(doc.resident._id) : doc.resident ? String(doc.resident) : null;
    if (!authorize(ownerId)) return { status: 403 as const };
    if (!doc.isPaid) return { status: 400 as const };

    if (!doc.receiptNumber) {
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
}
