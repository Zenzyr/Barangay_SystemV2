import { ReportResponse, ReportType } from "@/app/types/report.type";
import { TransactionItem } from "@/app/types/transaction.type";
import { WorkRequestItem } from "@/app/types/work.type";
import { STATUS_CONFIG } from "@/app/utils/documentRequestOptions";
import {
  PAYMENT_METHOD_LABELS,
  REQUEST_SOURCE_LABELS,
  formatChannel,
  formatCurrency,
  formatDateTime,
} from "@/app/utils/transactionFormat";
import { WORK_KIND_LABELS, WORK_STATUS_CONFIG, formatScheduleDate } from "@/app/utils/workRequest";

export type ReportRow = TransactionItem | WorkRequestItem;

export interface ReportColumn {
  key: string;
  label: string;
  value: (row: ReportRow) => string;
  sortValue?: (row: ReportRow) => string | number;
  align?: "left" | "right";
  width?: string;
}

const tx = (row: ReportRow) => row as TransactionItem;
const work = (row: ReportRow) => row as WorkRequestItem;
const methodLabel = (m: TransactionItem["paymentMethod"]) => (m ? PAYMENT_METHOD_LABELS[m] : "—");

export const REPORT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  documents: [
    { key: "requestDate", label: "Requested", value: (r) => tx(r).requestDate || "—", sortValue: (r) => tx(r).requestDate || "", width: "9%" },
    { key: "resident", label: "Resident", value: (r) => tx(r).residentName, width: "16%" },
    { key: "document", label: "Document", value: (r) => tx(r).documentName, width: "19%" },
    { key: "source", label: "Type", value: (r) => REQUEST_SOURCE_LABELS[tx(r).requestSource], width: "8%" },
    { key: "status", label: "Status", value: (r) => STATUS_CONFIG[tx(r).requestStatus]?.label || tx(r).requestStatus, width: "9%" },
    { key: "payment", label: "Payment", value: (r) => (tx(r).paymentStatus === "paid" ? "Paid" : "Unpaid"), width: "7%" },
    { key: "method", label: "Method", value: (r) => methodLabel(tx(r).paymentMethod), width: "11%" },
    { key: "amount", label: "Amount", value: (r) => formatCurrency(tx(r).amount), sortValue: (r) => tx(r).amount, align: "right", width: "9%" },
    { key: "receipt", label: "Receipt No.", value: (r) => tx(r).receiptNumber || "—", width: "12%" },
  ],
  payments: [
    { key: "paidAt", label: "Date Paid", value: (r) => formatDateTime(tx(r).paidAt || tx(r).transactionDate), sortValue: (r) => tx(r).paidAt || tx(r).transactionDate, width: "14%" },
    { key: "receipt", label: "Receipt No.", value: (r) => tx(r).receiptNumber || "—", width: "13%" },
    { key: "resident", label: "Resident", value: (r) => tx(r).residentName, width: "15%" },
    { key: "document", label: "Document", value: (r) => tx(r).documentName, width: "18%" },
    { key: "method", label: "Method", value: (r) => methodLabel(tx(r).paymentMethod), width: "11%" },
    { key: "channel", label: "Channel", value: (r) => formatChannel(tx(r).paymentChannel), width: "8%" },
    { key: "reference", label: "Reference", value: (r) => tx(r).paymentReference || "—", width: "12%" },
    { key: "amount", label: "Amount", value: (r) => formatCurrency(tx(r).amount), sortValue: (r) => tx(r).amount, align: "right", width: "9%" },
  ],
  work: [
    { key: "createdAt", label: "Created", value: (r) => formatDateTime(work(r).createdAt), sortValue: (r) => work(r).createdAt, width: "13%" },
    { key: "title", label: "Request", value: (r) => work(r).title, width: "16%" },
    { key: "category", label: "Category", value: (r) => work(r).category || "—", width: "10%" },
    { key: "kind", label: "Type", value: (r) => WORK_KIND_LABELS[work(r).kind], width: "10%" },
    { key: "client", label: "Resident", value: (r) => work(r).client?.name || "—", width: "13%" },
    { key: "provider", label: "Provider", value: (r) => work(r).provider?.name || "—", width: "13%" },
    {
      key: "schedule",
      label: "Schedule",
      value: (r) => (work(r).scheduledDate ? `${formatScheduleDate(work(r).scheduledDate, { month: "short", day: "numeric", year: "numeric" })}, ${work(r).scheduleLabel}` : "Not scheduled"),
      sortValue: (r) => `${work(r).scheduledDate || ""} ${work(r).scheduleStartTime || ""}`,
      width: "16%",
    },
    { key: "status", label: "Status", value: (r) => WORK_STATUS_CONFIG[work(r).status]?.label || work(r).status, width: "9%" },
  ],
};

export interface SummaryStat {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

export function summaryStats(report: ReportResponse): SummaryStat[] {
  if (report.type === "documents") {
    const s = report.summary;
    return [
      { label: "Total Requests", value: String(s.totalRequests) },
      { label: "Completed", value: String(s.completed), hint: "Released", tone: "success" },
      { label: "Pending / In Progress", value: String(s.inProgress), tone: "warning" },
      { label: "Cancelled / Rejected", value: String(s.cancelled), tone: "danger" },
      { label: "Revenue Collected", value: formatCurrency(s.revenue), hint: `${s.paid} paid`, tone: "success" },
      { label: "Outstanding", value: formatCurrency(s.outstanding), hint: `${s.unpaid} unpaid`, tone: "warning" },
      { label: "Walk-in Requests", value: String(s.walkIn), tone: "info" },
      { label: "Online Requests", value: String(s.online), tone: "info" },
    ];
  }
  if (report.type === "payments") {
    const s = report.summary;
    return [
      { label: "Transactions", value: String(s.totalTransactions) },
      { label: "Total Revenue", value: formatCurrency(s.totalRevenue), tone: "success" },
      { label: "Average Payment", value: formatCurrency(s.averageAmount) },
      { label: "Over-the-Counter", value: formatCurrency(s.overTheCounterRevenue), hint: `${s.overTheCounterCount} payments`, tone: "info" },
      { label: "Online", value: formatCurrency(s.onlineRevenue), hint: `${s.onlineCount} payments`, tone: "info" },
      { label: "From Walk-in Requests", value: String(s.walkInRequests) },
      { label: "From Online Requests", value: String(s.onlineRequests) },
    ];
  }
  const s = report.summary;
  return [
    { label: "Total Requests", value: String(s.totalRequests) },
    { label: "Pending", value: String(s.pending), tone: "warning" },
    { label: "In Progress", value: String(s.active), tone: "info" },
    { label: "Completed", value: String(s.completed), tone: "success" },
    { label: "Rejected", value: String(s.rejected), tone: "danger" },
    { label: "Scheduled", value: String(s.scheduled), hint: `${s.totalRequests - s.scheduled} without schedule` },
    { label: "Bookings", value: String(s.bookings) },
    { label: "Service Contracts", value: String(s.serviceRequests) },
  ];
}

export interface BreakdownTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export function breakdowns(report: ReportResponse): BreakdownTable[] {
  if (report.type === "documents") {
    return [
      {
        title: "By Document Type",
        headers: ["Document", "Requests", "Paid", "Revenue"],
        rows: report.byDocument.map((d) => [d.documentName, String(d.count), String(d.paid), formatCurrency(d.revenue)]),
      },
      {
        title: "By Status",
        headers: ["Status", "Requests"],
        rows: report.byStatus.map((b) => [STATUS_CONFIG[b.status]?.label || b.status, String(b.count)]),
      },
    ];
  }
  if (report.type === "payments") {
    return [
      {
        title: "By Document Type",
        headers: ["Document", "Payments", "Revenue"],
        rows: report.byDocument.map((d) => [d.documentName, String(d.count), formatCurrency(d.revenue)]),
      },
      {
        title: "By Payment Channel",
        headers: ["Channel", "Payments", "Revenue"],
        rows: report.byChannel.map((c) => [formatChannel(c.channel), String(c.count), formatCurrency(c.revenue)]),
      },
    ];
  }
  return [
    {
      title: "By Category",
      headers: ["Category", "Requests"],
      rows: report.byCategory.map((c) => [c.category, String(c.count)]),
    },
  ];
}
