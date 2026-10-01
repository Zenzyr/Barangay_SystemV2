import { TransactionItem } from "./transaction.type";
import { WorkRequestItem } from "./work.type";

export type ReportType = "documents" | "payments" | "work";

export interface ReportFilters {
  from?: string;
  to?: string;
  document?: string;
  source?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  kind?: string;
  search?: string;
}

interface ReportBase {
  generatedAt: string;
  filters: ReportFilters;
  totalRows: number;
  truncated: boolean;
}

export interface DocumentReport extends ReportBase {
  type: "documents";
  summary: {
    totalRequests: number;
    completed: number;
    inProgress: number;
    cancelled: number;
    paid: number;
    unpaid: number;
    revenue: number;
    outstanding: number;
    walkIn: number;
    online: number;
    overTheCounterRevenue: number;
    onlineRevenue: number;
  };
  byStatus: { status: string; count: number }[];
  byDocument: { document: string; documentName: string; count: number; paid: number; revenue: number }[];
  rows: TransactionItem[];
}

export interface PaymentReport extends ReportBase {
  type: "payments";
  summary: {
    totalTransactions: number;
    totalRevenue: number;
    averageAmount: number;
    overTheCounterCount: number;
    overTheCounterRevenue: number;
    onlineCount: number;
    onlineRevenue: number;
    walkInRequests: number;
    onlineRequests: number;
  };
  byDocument: { document: string; documentName: string; count: number; revenue: number }[];
  byChannel: { channel: string; count: number; revenue: number }[];
  rows: TransactionItem[];
}

export interface WorkReport extends ReportBase {
  type: "work";
  summary: {
    totalRequests: number;
    pending: number;
    active: number;
    completed: number;
    rejected: number;
    scheduled: number;
    bookings: number;
    serviceRequests: number;
  };
  byCategory: { category: string; count: number }[];
  rows: WorkRequestItem[];
}

export type ReportResponse = DocumentReport | PaymentReport | WorkReport;
