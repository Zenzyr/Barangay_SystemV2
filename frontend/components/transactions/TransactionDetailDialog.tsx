"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { PaymentHistoryEntry, TransactionDetail } from "@/app/types/transaction.type";
import { STATUS_CONFIG } from "@/app/utils/documentRequestOptions";
import {
  REQUEST_SOURCE_LABELS,
  apiErrorMessage,
  formatChannel,
  formatCurrency,
  formatDateTime,
} from "@/app/utils/transactionFormat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/shared/StatusBadge";
import { DataError } from "@/components/ui/data-state-renderer";
import { PaymentMethodBadge, PaymentStatusBadge } from "./TransactionHistory";
import { ReceiptDialog } from "./ReceiptDialog";
import {
  CircleDollarSign,
  FilePen,
  History,
  Printer,
  Receipt,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const HISTORY_META: Record<PaymentHistoryEntry["action"], { label: string; icon: typeof History; tone: string }> = {
  recorded: { label: "Payment recorded", icon: CircleDollarSign, tone: "bg-sky-50 text-sky-600" },
  verified: { label: "Payment verified", icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-600" },
  rejected: { label: "Payment rejected", icon: ShieldX, tone: "bg-rose-50 text-rose-600" },
  corrected: { label: "Details corrected", icon: FilePen, tone: "bg-violet-50 text-violet-600" },
  cleared: { label: "Payment cleared", icon: History, tone: "bg-slate-100 text-slate-600" },
  receipt_reprinted: { label: "Receipt reprinted", icon: Printer, tone: "bg-slate-100 text-slate-600" },
};

const FIELD_LABELS: Record<string, string> = {
  paymentReference: "Reference",
  paymentChannel: "Channel",
  amountTendered: "Amount tendered",
  changeGiven: "Change",
};

function formatChange(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "amountTendered" || field === "changeGiven") return formatCurrency(Number(value));
  if (field === "paymentChannel") return formatChannel(String(value));
  return String(value);
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <div className="text-sm text-gray-900 mt-0.5 break-words">{value || "—"}</div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof History; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
        <Icon className="size-3.5 text-sky-600" />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function useTransactionDetail(id: string | null | undefined, enabled = true) {
  return useQuery<TransactionDetail>({
    queryKey: ["transactions", "detail", id],
    queryFn: async () => (await axiosInstance.get(`/transactions/${id}`)).data,
    enabled: !!id && enabled,
    retry: false,
  });
}

export function TransactionDetailDialog({
  transactionId,
  onOpenChange,
}: {
  transactionId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = !!transactionId;
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const { data: tx, isLoading, isError, error, refetch } = useTransactionDetail(transactionId, open);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-gray-900">Payment Transaction</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              {tx ? `${tx.transactionNumber} · ${tx.documentName}` : "Loading transaction details"}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isError || !tx ? (
            <DataError message={apiErrorMessage(error, "The transaction could not be loaded.")} refetch={refetch} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-sky-50 to-emerald-50 border border-sky-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Amount</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(tx.amount)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PaymentStatusBadge status={tx.paymentStatus} />
                  <PaymentMethodBadge method={tx.paymentMethod} />
                </div>
              </div>

              <Section title="Payment" icon={CircleDollarSign}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Transaction No." value={<span className="font-mono">{tx.transactionNumber}</span>} />
                  <Field label="Receipt No." value={tx.receiptNumber ? <span className="font-mono">{tx.receiptNumber}</span> : "Not issued"} />
                  <Field label="Payment Reference" value={tx.paymentReference} />
                  <Field label="Channel" value={formatChannel(tx.paymentChannel)} />
                  <Field label="Date Paid" value={formatDateTime(tx.paidAt)} />
                  <Field label="Recorded By" value={tx.processedBy || (tx.paymentMethod === "online" ? "Online checkout" : null)} />
                  {tx.amountTendered !== null && <Field label="Amount Tendered" value={formatCurrency(tx.amountTendered)} />}
                  {tx.changeGiven !== null && <Field label="Change" value={formatCurrency(tx.changeGiven)} />}
                </div>
              </Section>

              <Section title="Resident & Request" icon={UserRound}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Resident" value={tx.residentName} />
                  <Field label="Email" value={tx.residentEmail} />
                  <Field label="Contact" value={tx.residentContact} />
                  <Field label="Address" value={[tx.residentAddress, tx.residentPurok].filter(Boolean).join(", ")} className="col-span-2 sm:col-span-3" />
                  <Field label="Document" value={tx.documentName} />
                  <Field label="Request Type" value={`${REQUEST_SOURCE_LABELS[tx.requestSource]} request`} />
                  <Field label="Request Status" value={<StatusBadge status={tx.requestStatus} config={STATUS_CONFIG} />} />
                  {tx.purpose && <Field label="Purpose" value={tx.purpose} />}
                  {tx.documentNumber && <Field label="Document No." value={tx.documentNumber} />}
                  <Field label="Requested" value={tx.requestDate} />
                </div>
              </Section>

              <Section title="Transaction History" icon={History}>
                {tx.history.length === 0 ? (
                  <p className="text-xs text-gray-400">No payment activity has been recorded yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {tx.history.map((h, i) => {
                      const meta = HISTORY_META[h.action] ?? HISTORY_META.recorded;
                      return (
                        <li key={i} className="flex gap-3">
                          <div className={cn("size-7 rounded-full flex items-center justify-center shrink-0", meta.tone)}>
                            <meta.icon className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {meta.label}
                              {h.byName && <span className="font-normal text-gray-500"> · {h.byName}</span>}
                            </p>
                            <p className="text-[11px] text-gray-400">{formatDateTime(h.at)}</p>
                            {h.receiptNumber && h.action !== "receipt_reprinted" && (
                              <p className="text-xs text-gray-500">
                                Receipt <span className="font-mono">{h.receiptNumber}</span>
                                {h.amount !== null && ` · ${formatCurrency(h.amount)}`}
                                {h.paymentChannel && ` · ${formatChannel(h.paymentChannel)}`}
                              </p>
                            )}
                            {h.note && <p className="text-xs text-gray-600 mt-0.5">“{h.note}”</p>}
                            {h.changes &&
                              Object.entries(h.changes).map(([field, change]) => (
                                <p key={field} className="text-xs text-gray-500">
                                  {FIELD_LABELS[field] || field}: {formatChange(field, change.from)} → <strong className="text-gray-700">{formatChange(field, change.to)}</strong>
                                </p>
                              ))}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Section>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {(tx.receiptAvailable || tx.receiptVoided) && (
                  <Button variant="outline" onClick={() => setReceiptId(tx._id)} className="h-10 gap-2 border-gray-200 sm:mr-auto">
                    <Receipt className="size-4" /> {tx.receiptVoided ? "View Voided Receipt" : "View Receipt"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReceiptDialog open={!!receiptId} onOpenChange={(o) => !o && setReceiptId(null)} requestId={receiptId} />
    </>
  );
}
