export type PaymentMethod = "over-the-counter" | "online";
export type PaymentStatus = "paid" | "unpaid";

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
  barangay: { name: string; address: string; contactNumber: string; email: string; logoUrl: string };
}
