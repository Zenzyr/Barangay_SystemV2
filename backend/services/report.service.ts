import DocumentRequestModel from "../model/documentRequest.model";
import {
  REPORT_TIMEZONE,
  TransactionFilters,
  buildTransactionMatch,
  baseTransactionScope,
  toTransactionItem,
  transactionBaseStages,
} from "./transaction.service";
import { WorkRequestKind, WorkRequestService } from "./workRequest.service";
import { documentDisplayName } from "../utils/documentNames";

export const REPORT_ROW_LIMIT = 2000;

export const DOCUMENT_STATUS_GROUPS = {
  completed: ["released", "completed"],
  inProgress: ["pending", "processing", "ready", "to claim"],
  cancelled: ["cancelled", "rejected"],
};

export interface DocumentReportFilters extends TransactionFilters {
  status?: string;
}

export interface WorkReportFilters {
  from?: string;
  to?: string;
  status?: string;
  kind?: WorkRequestKind;
  search?: string;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const requestDayStage = {
  $addFields: {
    _reqDay: {
      $ifNull: [
        "$requestDate",
        { $dateToString: { format: "%Y-%m-%d", date: "$_requestedAt", timezone: REPORT_TIMEZONE } },
      ],
    },
  },
};

export class ReportService {

  static async documents(filters: DocumentReportFilters) {
    const { from, to, status, ...rest } = filters;
    const match = buildTransactionMatch(rest);
    if (status) match.status = status;
    if (from || to) {
      match._reqDay = {};
      if (from) match._reqDay.$gte = from;
      if (to) match._reqDay.$lte = to;
    }

    const isPaid = { $eq: ["$isPaid", true] };
    const [result] = await DocumentRequestModel.aggregate([
      ...transactionBaseStages(),
      requestDayStage,
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalRequests: { $sum: 1 },
                completed: { $sum: { $cond: [{ $in: ["$status", DOCUMENT_STATUS_GROUPS.completed] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $in: ["$status", DOCUMENT_STATUS_GROUPS.inProgress] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $in: ["$status", DOCUMENT_STATUS_GROUPS.cancelled] }, 1, 0] } },
                paid: { $sum: { $cond: [isPaid, 1, 0] } },
                revenue: { $sum: { $cond: [isPaid, "$_amount", 0] } },
                outstanding: { $sum: { $cond: [isPaid, 0, "$_amount"] } },
                walkIn: { $sum: { $cond: [{ $eq: ["$_source", "walk-in"] }, 1, 0] } },
                online: { $sum: { $cond: [{ $eq: ["$_source", "walk-in"] }, 0, 1] } },
                overTheCounterRevenue: {
                  $sum: { $cond: [{ $and: [isPaid, { $eq: ["$_method", "over-the-counter"] }] }, "$_amount", 0] },
                },
                onlineRevenue: {
                  $sum: { $cond: [{ $and: [isPaid, { $eq: ["$_method", "online"] }] }, "$_amount", 0] },
                },
              },
            },
          ],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
          byDocument: [
            {
              $group: {
                _id: "$document",
                count: { $sum: 1 },
                paid: { $sum: { $cond: [isPaid, 1, 0] } },
                revenue: { $sum: { $cond: [isPaid, "$_amount", 0] } },
              },
            },
            { $sort: { count: -1 } },
          ],
          rows: [{ $sort: { _requestedAt: -1, _id: -1 } }, { $limit: REPORT_ROW_LIMIT }],
        },
      },
    ]);

    const s = result?.summary?.[0] ?? {};
    const totalRequests = s.totalRequests ?? 0;
    return {
      type: "documents" as const,
      summary: {
        totalRequests,
        completed: s.completed ?? 0,
        inProgress: s.inProgress ?? 0,
        cancelled: s.cancelled ?? 0,
        paid: s.paid ?? 0,
        unpaid: totalRequests - (s.paid ?? 0),
        revenue: round2(s.revenue),
        outstanding: round2(s.outstanding),
        walkIn: s.walkIn ?? 0,
        online: s.online ?? 0,
        overTheCounterRevenue: round2(s.overTheCounterRevenue),
        onlineRevenue: round2(s.onlineRevenue),
      },
      byStatus: (result?.byStatus ?? []).map((b: any) => ({ status: b._id, count: b.count })),
      byDocument: (result?.byDocument ?? []).map((b: any) => ({
        document: b._id,
        documentName: documentDisplayName(b._id),
        count: b.count,
        paid: b.paid,
        revenue: round2(b.revenue),
      })),
      rows: (result?.rows ?? []).map((doc: any) => ({
        ...toTransactionItem(doc),
        requestDate: doc._reqDay,
      })),
      totalRows: totalRequests,
      truncated: totalRequests > REPORT_ROW_LIMIT,
    };
  }

  static async payments(filters: TransactionFilters) {
    const match = buildTransactionMatch({ ...filters, paymentStatus: "paid" });
    const [result] = await DocumentRequestModel.aggregate([
      { $match: baseTransactionScope() },
      ...transactionBaseStages(),
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalTransactions: { $sum: 1 },
                totalRevenue: { $sum: "$_amount" },
                overTheCounterCount: { $sum: { $cond: [{ $eq: ["$_method", "over-the-counter"] }, 1, 0] } },
                overTheCounterRevenue: { $sum: { $cond: [{ $eq: ["$_method", "over-the-counter"] }, "$_amount", 0] } },
                onlineCount: { $sum: { $cond: [{ $eq: ["$_method", "online"] }, 1, 0] } },
                onlineRevenue: { $sum: { $cond: [{ $eq: ["$_method", "online"] }, "$_amount", 0] } },
                walkInRequests: { $sum: { $cond: [{ $eq: ["$_source", "walk-in"] }, 1, 0] } },
              },
            },
          ],
          byDocument: [
            { $group: { _id: "$document", count: { $sum: 1 }, revenue: { $sum: "$_amount" } } },
            { $sort: { revenue: -1 } },
          ],
          byChannel: [
            {
              $group: {
                _id: { $ifNull: ["$paymentChannel", { $cond: [{ $eq: ["$_method", "online"] }, "paymongo", "cash"] }] },
                count: { $sum: 1 },
                revenue: { $sum: "$_amount" },
              },
            },
            { $sort: { revenue: -1 } },
          ],
          rows: [{ $sort: { _txAt: -1, _id: -1 } }, { $limit: REPORT_ROW_LIMIT }],
        },
      },
    ]);

    const s = result?.summary?.[0] ?? {};
    const totalTransactions = s.totalTransactions ?? 0;
    return {
      type: "payments" as const,
      summary: {
        totalTransactions,
        totalRevenue: round2(s.totalRevenue),
        averageAmount: totalTransactions ? round2((s.totalRevenue ?? 0) / totalTransactions) : 0,
        overTheCounterCount: s.overTheCounterCount ?? 0,
        overTheCounterRevenue: round2(s.overTheCounterRevenue),
        onlineCount: s.onlineCount ?? 0,
        onlineRevenue: round2(s.onlineRevenue),
        walkInRequests: s.walkInRequests ?? 0,
        onlineRequests: totalTransactions - (s.walkInRequests ?? 0),
      },
      byDocument: (result?.byDocument ?? []).map((b: any) => ({
        document: b._id,
        documentName: documentDisplayName(b._id),
        count: b.count,
        revenue: round2(b.revenue),
      })),
      byChannel: (result?.byChannel ?? []).map((b: any) => ({ channel: b._id, count: b.count, revenue: round2(b.revenue) })),
      rows: (result?.rows ?? []).map(toTransactionItem),
      totalRows: totalTransactions,
      truncated: totalTransactions > REPORT_ROW_LIMIT,
    };
  }

  static async workRequests(filters: WorkReportFilters) {
    const items = await WorkRequestService.list({ ...filters, dateField: "created" });
    const count = (statuses: string[]) => items.filter((i) => statuses.includes(i.status)).length;

    const byCategoryMap = new Map<string, number>();
    for (const item of items) {
      const key = item.category || "Uncategorized";
      byCategoryMap.set(key, (byCategoryMap.get(key) ?? 0) + 1);
    }

    return {
      type: "work" as const,
      summary: {
        totalRequests: items.length,
        pending: count(["pending"]),
        active: count(["active", "accepted", "to review"]),
        completed: count(["completed"]),
        rejected: count(["rejected"]),
        scheduled: items.filter((i) => !!i.scheduledDate).length,
        bookings: items.filter((i) => i.kind === "booking").length,
        serviceRequests: items.filter((i) => i.kind === "service").length,
      },
      byCategory: [...byCategoryMap.entries()]
        .map(([category, total]) => ({ category, count: total }))
        .sort((a, b) => b.count - a.count),
      rows: items.slice(0, REPORT_ROW_LIMIT),
      totalRows: items.length,
      truncated: items.length > REPORT_ROW_LIMIT,
    };
  }
}
