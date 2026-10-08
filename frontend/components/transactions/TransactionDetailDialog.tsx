"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { PaymentHistoryEntry, TransactionDetail } from "@/app/types/transaction.type";
import { STATUS_CONFIG } from "@/app/utils/documentRequestOptions";
import {
  REQUEST_SOURCE_LABELS,
  apiErrorMessage,
  formatChannel,
  formatCurrency,
  formatDateTime,
} from "@/app/utils/transactionFormat";
import { PERMISSIONS, hasPermission } from "@/lib/constants/roles";
import { PAYMENT_VERIFICATION_CONFIG } from "@/lib/constants/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/shared/StatusBadge";
import { DataError } from "@/components/ui/data-state-renderer";
import { PaymentMethodBadge, PaymentStatusBadge } from "./TransactionHistory";
import { ReceiptDialog } from "./ReceiptDialog";
import {
  ArrowLeft,
  CircleDollarSign,
  FilePen,
  History,
  Loader2,
  Printer,
  Receipt,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "view" | "verify" | "reject" | "correct";

const ONLINE_CHANNELS = ["paymongo", "gcash", "paymaya", "grab_pay", "card", "dob", "qrph", "billease"];
const OTC_CHANNELS = ["cash"];

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
  initialMode = "view",
}: {
  transactionId: string | null;
  onOpenChange: (open: boolean) => void;
  initialMode?: Mode;
}) {
  const open = !!transactionId;
  const role = useUserStore((s) => s.user?.role);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [lastId, setLastId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState({ paymentReference: "", paymentChannel: "", amountTendered: "" });
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const { data: tx, isLoading, isError, error, refetch } = useTransactionDetail(transactionId, open);

  if (transactionId !== lastId) {
    setLastId(transactionId);
    setMode(initialMode);
    setNote("");
    setReason("");
    setCorrection({ paymentReference: "", paymentChannel: "", amountTendered: "" });
  }

  const canVerify = hasPermission(role, PERMISSIONS.PAYMENTS_VERIFY);
  const canReject = hasPermission(role, PERMISSIONS.PAYMENTS_REJECT);
  const canCorrect = hasPermission(role, PERMISSIONS.PAYMENTS_CORRECT);
  const isPending = tx?.verificationStatus === "pending" && tx.paymentStatus === "paid";

  const onDone = (message: string) => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["document-requests"] });
    setMode("view");
    setNote("");
    setReason("");
  };

  const verifyMutation = useMutation({
    mutationFn: () => axiosInstance.patch(`/transactions/${transactionId}/verify`, { note: note.trim() || undefined }),
    onSuccess: () => onDone("Payment verified"),
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to verify the payment")),
  });

  const rejectMutation = useMutation({
    mutationFn: () => axiosInstance.patch(`/transactions/${transactionId}/reject`, { reason: reason.trim() }),
    onSuccess: () => onDone("Payment rejected"),
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to reject the payment")),
  });

  const correctMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { reason: reason.trim() };
      if (tx && correction.paymentReference.trim() !== (tx.paymentReference || "")) body.paymentReference = correction.paymentReference.trim();
      if (tx && correction.paymentChannel && correction.paymentChannel !== tx.paymentChannel) body.paymentChannel = correction.paymentChannel;
      if (tx && correction.amountTendered !== "" && Number(correction.amountTendered) !== tx.amountTendered) body.amountTendered = Number(correction.amountTendered);
      return axiosInstance.patch(`/transactions/${transactionId}/correct`, body);
    },
    onSuccess: () => onDone("Transaction corrected"),
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to correct the transaction")),
  });

  const busy = verifyMutation.isPending || rejectMutation.isPending || correctMutation.isPending;

  const startCorrection = () => {
    if (!tx) return;
    setCorrection({
      paymentReference: tx.paymentReference || "",
      paymentChannel: tx.paymentChannel || "",
      amountTendered: tx.amountTendered !== null ? String(tx.amountTendered) : "",
    });
    setReason("");
    setMode("correct");
  };

  const reasonValid = reason.trim().length >= 5 && reason.trim().length <= 500;
  const channels = tx?.paymentMethod === "online" ? ONLINE_CHANNELS : OTC_CHANNELS;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              {mode !== "view" && (
                <button type="button" onClick={() => setMode("view")} disabled={busy} className="rounded-md p-1 hover:bg-gray-100" aria-label="Back to details">
                  <ArrowLeft className="size-4" />
                </button>
              )}
              {mode === "verify" ? "Verify Payment" : mode === "reject" ? "Reject Payment" : mode === "correct" ? "Correct Transaction" : "Payment Transaction"}
            </DialogTitle>
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
          ) : mode === "view" ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-sky-50 to-emerald-50 border border-sky-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Amount</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(tx.amount)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tx.verificationStatus && <StatusBadge status={tx.verificationStatus} config={PAYMENT_VERIFICATION_CONFIG} />}
                  <PaymentStatusBadge status={tx.paymentStatus} />
                  <PaymentMethodBadge method={tx.paymentMethod} />
                </div>
              </div>

              {tx.verificationStatus === "rejected" && tx.rejectionReason && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <strong>Rejected:</strong> {tx.rejectionReason}
                </div>
              )}

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

              <Section title="Verification" icon={ShieldCheck}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Status" value={tx.verificationStatus ? PAYMENT_VERIFICATION_CONFIG[tx.verificationStatus]?.label : "No payment recorded"} />
                  {tx.verifiedBy && <Field label="Verified By" value={tx.verifiedBy} />}
                  {tx.verifiedAt && <Field label="Verified At" value={formatDateTime(tx.verifiedAt)} />}
                  {tx.rejectedBy && <Field label="Rejected By" value={tx.rejectedBy} />}
                  {tx.rejectedAt && <Field label="Rejected At" value={formatDateTime(tx.rejectedAt)} />}
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
                {isPending && canCorrect && (
                  <Button variant="outline" onClick={startCorrection} className="h-10 gap-2 border-gray-200">
                    <FilePen className="size-4" /> Correct
                  </Button>
                )}
                {isPending && canReject && (
                  <Button variant="outline" onClick={() => { setReason(""); setMode("reject"); }} className="h-10 gap-2 border-rose-200 text-rose-700 hover:bg-rose-50">
                    <ShieldX className="size-4" /> Reject
                  </Button>
                )}
                {isPending && canVerify && (
                  <Button onClick={() => setMode("verify")} className="h-10 gap-2 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white">
                    <ShieldCheck className="size-4" /> Verify Payment
                  </Button>
                )}
              </div>
            </div>
          ) : mode === "verify" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Confirm that <strong>{formatCurrency(tx.amount)}</strong> from <strong>{tx.residentName}</strong> ({formatChannel(tx.paymentChannel)}
                {tx.paymentReference ? `, ref. ${tx.paymentReference}` : ""}) was received. Verified payments are counted in collection totals.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="verify-note" className="text-xs text-gray-600">Note (optional)</Label>
                <Textarea id="verify-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash counted and deposited" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode("view")} disabled={busy} className="border-gray-200">Cancel</Button>
                <Button onClick={() => verifyMutation.mutate()} disabled={busy} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {verifyMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Confirm Verification
                </Button>
              </div>
            </div>
          ) : mode === "reject" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                Rejecting marks this payment as unpaid and voids receipt <strong className="font-mono">{tx.receiptNumber}</strong>. The original transaction is kept in the history and the resident is notified.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reject-reason" className="text-xs text-gray-600">Reason for rejection *</Label>
                <Textarea id="reject-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Reference number not found in the PayMongo dashboard" />
                <p className={cn("text-[11px]", reason && !reasonValid ? "text-rose-600" : "text-gray-400")}>At least 5 characters. This is shown to the resident.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode("view")} disabled={busy} className="border-gray-200">Cancel</Button>
                <Button onClick={() => rejectMutation.mutate()} disabled={busy || !reasonValid} className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
                  {rejectMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldX className="size-4" />}
                  Reject Payment
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Only details that do not change the amount due can be corrected, and only while the payment is awaiting verification. Every correction is recorded in the history and audit trail.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fix-reference" className="text-xs text-gray-600">Payment reference</Label>
                  <Input id="fix-reference" value={correction.paymentReference} maxLength={100} onChange={(e) => setCorrection((c) => ({ ...c, paymentReference: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Payment channel</Label>
                  <Select value={correction.paymentChannel || undefined} onValueChange={(v) => setCorrection((c) => ({ ...c, paymentChannel: v }))}>
                    <SelectTrigger className="w-full h-9 border-gray-200 bg-white text-sm">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c} value={c}>{formatChannel(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {tx.paymentMethod === "over-the-counter" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fix-tendered" className="text-xs text-gray-600">Amount tendered</Label>
                    <Input
                      id="fix-tendered"
                      type="number"
                      min={tx.amount}
                      step="0.01"
                      value={correction.amountTendered}
                      onChange={(e) => setCorrection((c) => ({ ...c, amountTendered: e.target.value }))}
                    />
                    {correction.amountTendered !== "" && Number(correction.amountTendered) >= tx.amount && (
                      <p className="text-[11px] text-gray-500">Change: {formatCurrency(Number(correction.amountTendered) - tx.amount)}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fix-reason" className="text-xs text-gray-600">Reason for correction *</Label>
                <Textarea id="fix-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Reference number was encoded incorrectly" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode("view")} disabled={busy} className="border-gray-200">Cancel</Button>
                <Button onClick={() => correctMutation.mutate()} disabled={busy || !reasonValid} className="gap-2 bg-gray-900 hover:bg-gray-800 text-white">
                  {correctMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FilePen className="size-4" />}
                  Save Correction
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReceiptDialog open={!!receiptId} onOpenChange={(o) => !o && setReceiptId(null)} requestId={receiptId} />
    </>
  );
}
