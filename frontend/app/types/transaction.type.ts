export type PaymentMethod = "over-the-counter" | "online";
export type PaymentStatus = "paid" | "unpaid";
export type VerificationStatus = "pending" | "verified" | "rejected";

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

export interface TransactionListResponse {
  items: TransactionItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: {
    paidCount: number;
    unpaidCount: number;
    paidAmount: number;
    unpaidAmount: number;
    verifiedCount: number;
    verifiedAmount: number;
    pendingVerificationCount: number;
    pendingVerificationAmount: number;
    rejectedCount: number;
  };
}

export interface TransactionFilters {
  search?: string;
  from?: string;
  to?: string;
  paymentMethod?: PaymentMethod | "";
  paymentStatus?: PaymentStatus | "";
  document?: string;
  source?: "online" | "walk-in" | "";
  resident?: string;
  verificationStatus?: VerificationStatus | "";
  receipt?: "issued" | "";
}

export interface ReceiptData {
  requestId: string;
  residentId: string | null;
  receiptNumber: string;
  paidAt: string | null;
  paymentMethod: PaymentMethod;
  paymentChannel: string | null;
  paymentReference: string | null;
  requestSource: "online" | "walk-in";
  amount: number;
  amountTendered: number | null;
  changeGiven: number | null;
  processedBy: string | null;
  payer: { name: string; address: string; contact: string };
  item: { document: string; documentName: string; documentNumber: string | null };
  requestStatus: string;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  voided: boolean;
  rejectionReason: string | null;
  barangay: { name: string; address: string; contactNumber: string; email: string; logoUrl: string };
}

export type PaymentHistoryAction = "recorded" | "verified" | "rejected" | "corrected" | "cleared" | "receipt_reprinted";

export interface PaymentHistoryEntry {
  action: PaymentHistoryAction;
  at: string | null;
  byName: string | null;
  note: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  receiptNumber: string | null;
  amount: number | null;
  paymentMethod: PaymentMethod | null;
  paymentChannel: string | null;
  paymentReference: string | null;
}

export interface TransactionDetail extends TransactionItem {
  residentContact: string;
  residentAddress: string;
  residentPurok: string;
  purpose: string | null;
  documentNumber: string | null;
  processedBy: string | null;
  verifiedBy: string | null;
  rejectedBy: string | null;
  history: PaymentHistoryEntry[];
}

export interface TreasurerDashboard {
  date: string;
  timeZone: string;
  today: { collected: number; verifiedCount: number; pendingAmount: number; transactions: number };
  pendingVerification: { count: number; amount: number };
  totals: {
    collected: number;
    verifiedCount: number;
    monthCollected: number;
    cashCollected: number;
    onlineCollected: number;
    rejectedCount: number;
  };
  lastSevenDays: { day: string; collected: number; pending: number; transactions: number }[];
  oldestPending: TransactionItem[];
  recent: TransactionItem[];
}
