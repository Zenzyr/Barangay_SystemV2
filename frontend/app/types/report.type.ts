import { TransactionItem } from "./transaction.type";
import { WorkRequestItem } from "./work.type";

export type ReportType = "documents" | "payments" | "work" | "collections" | "census";

export type CollectionPeriod = "daily" | "weekly" | "monthly";

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
  verificationStatus?: string;
  purok?: string;
  segment?: string;
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

export interface CollectionPeriodRow {
  period: string;
  from: string;
  to: string;
  transactions: number;
  verifiedCount: number;
  collected: number;
  cash: number;
  online: number;
  pending: number;
}

export interface CollectionReport extends ReportBase {
  type: "collections";
  summary: {
    totalTransactions: number;
    verifiedCount: number;
    totalCollected: number;
    averageCollected: number;
    cashCount: number;
    cashCollected: number;
    onlineCount: number;
    onlineCollected: number;
    pendingCount: number;
    pendingAmount: number;
    rejectedCount: number;
    rejectedAmount: number;
  };
  series: Record<CollectionPeriod, CollectionPeriodRow[]>;
  byDocument: { document: string; documentName: string; count: number; collected: number; pending: number }[];
  byChannel: { channel: string; count: number; collected: number }[];
  rows: TransactionItem[];
}

export interface CensusReportRow {
  _id: string;
  name: string;
  sex: string;
  age: number | string;
  occupation: string;
  education: string;
  purok: string;
  householdNumber: string;
  cellphone: string;
  isSenior: string;
  isPWD: string;
  is4Ps: string;
  soloParent: string;
  recordedAt?: string | null;
}

export interface CensusReport extends ReportBase {
  type: "census";
  summary: {
    total: number;
    households: number;
    male: number;
    female: number;
    seniors: number;
    pwd: number;
    fourPs: number;
    soloParents: number;
  };
  byPurok: { purok: string; residents: number; households: number }[];
  byEducation: { education: string; count: number }[];
  rows: CensusReportRow[];
}

export type ReportResponse = DocumentReport | PaymentReport | WorkReport | CollectionReport | CensusReport;
