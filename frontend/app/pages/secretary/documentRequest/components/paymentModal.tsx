"use client"

import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { documentTypes } from "@/app/utils/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { ReceiptPanel } from "@/components/transactions/ReceiptPanel";
import { apiErrorMessage } from "@/app/utils/transactionFormat";
import {
  Loader2,
  X,
  CheckCircle2,
  PhilippinePeso,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: documentRequestInterface | null;
}

const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  certificateOfLowIncome: "Certificate of Low Income",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  endorsementLetter: "Endorsement Letter",
};

// ─── Constants ───────────────────────────────────────────────────
const VAT_RATE = 0.12;

// ─── Helpers ─────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export default function PaymentModal({ open, onOpenChange, document: doc }: Props) {
  const queryClient = useQueryClient();

  // ── State ─────────────────────────────────────────────────────
  const [step, setStep] = useState<"input" | "receipt">("input");
  const [amountPaid, setAmountPaid] = useState<string>("");

  // Set initial step based on payment status
  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    if (doc?.isPaid) {
      setStep("receipt");
    } else {
      setStep("input");
      setAmountPaid("");
    }
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // Reset after the closing animation plays
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep("input");
        setAmountPaid("");
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // ── Lookup price ──────────────────────────────────────────────
  const price = useMemo(() => {
    if (!doc) return 0;
    if (typeof doc.feeAtRequest === "number") return doc.feeAtRequest;
    if (typeof doc.price === "number") return doc.price;
    const found = documentTypes.find((t) => t.document === doc.document);
    return found?.price || 0;
  }, [doc]);

  // ── Calculate change and VAT ──────────────────────────────────
  const amountPaidNum = parseFloat(amountPaid) || 0;
  const vatAmount = price * VAT_RATE;
  const vatExclusive = price - vatAmount;
  const MAX_PAYMENT = 100000; // reasonable upper bound to prevent absurd cash amounts
  const exceedsMax = amountPaidNum > MAX_PAYMENT;
  const change = amountPaidNum >= price ? amountPaidNum - price : 0;
  const isAmountValid = amountPaidNum >= price && amountPaidNum > 0 && !exceedsMax;

  // ── Payment mutation ──────────────────────────────────────────
  const paymentMutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.patch(`/document-request/${doc?._id}/payment`, {
        isPaid: true,
        amountTendered: amountPaidNum,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setStep("receipt");
      successAlert("Payment processed successfully!");
    },
    onError: (err: unknown) => {
      errorAlert(apiErrorMessage(err, "Failed to process payment"));
    },
  });

  if (!doc) return null;

  const isPending = paymentMutation.isPending;

  // ── ── Render: Payment Input ── ── ── ── ── ── ── ── ── ── ──
  const renderPaymentInput = () => (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="size-14 rounded-2xl bg-gradient-to-br from-amber-100 to-emerald-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <PhilippinePeso className="size-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Process Payment</h2>
        <p className="text-sm text-gray-500 mt-0.5">{DOCUMENT_NAMES[doc.document] || doc.document}</p>
      </div>

      {/* Resident */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
        <span className="text-sm text-gray-600">Resident</span>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">
          {doc.resident?.name || doc.fullName || "Unknown"}
        </span>
      </div>

      {/* Price */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-emerald-50/50 border border-sky-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Document Price</span>
          <span className="text-xl font-bold text-gray-900">{formatCurrency(price)}</span>
        </div>
        <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
          <span>VAT (12%): {formatCurrency(vatAmount)}</span>
          <span className="mx-1">•</span>
          <span>Excl. VAT: {formatCurrency(vatExclusive)}</span>
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Amount Paid by Resident</label>
        <div className="relative">
          <PhilippinePeso className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            type="number"
            min="0"
            max={MAX_PAYMENT}
            step="0.01"
            placeholder="0.00"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            className="pl-9 h-12 text-lg font-bold text-gray-900 border-gray-200 focus:border-emerald-400 focus:ring-emerald-400/20 bg-white"
            onFocus={(e) => e.target.select()}
          />
        </div>
        {exceedsMax && (
          <p className="text-xs text-rose-600">Amount cannot exceed {formatCurrency(MAX_PAYMENT)}</p>
        )}
      </div>

      {/* Change display */}
      {amountPaidNum > 0 && (
        <div className={`p-4 rounded-xl border text-center space-y-1 transition-all duration-200 ${
          isAmountValid
            ? "bg-emerald-50 border-emerald-200"
            : "bg-rose-50 border-rose-200"
        }`}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            {isAmountValid ? "Change" : "Insufficient Amount"}
          </p>
          <p className={`text-2xl font-bold ${isAmountValid ? "text-emerald-600" : "text-rose-600"}`}>
            {isAmountValid
              ? formatCurrency(change)
              : formatCurrency(Math.abs(price - amountPaidNum)) + " short"}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2.5">
        <Button
          onClick={() => paymentMutation.mutate()}
          disabled={!isAmountValid || isPending}
          className="w-full h-11 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-emerald-200/50 transition-all disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-5" />
          )}
          {isPending ? "Processing..." : "Process Payment"}
        </Button>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
          className="w-full h-10 border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderReceipt = () => (
    <div className="p-5 pt-10">
      <ReceiptPanel
        requestId={doc._id}
        enabled={open && step === "receipt"}
        actions={
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-10 border-gray-200 text-gray-600 hover:bg-gray-50 gap-2"
          >
            <X className="size-4" />
            Close
          </Button>
        }
      />
    </div>
  );

  // ── ── Main render ── ── ── ── ── ── ── ── ── ── ── ── ── ──
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>

      
      <DialogContent
        showCloseButton={false}
        className={`bg-white rounded-2xl p-0 gap-0 ${
          step === "receipt" ? "sm:max-w-sm" : "sm:max-w-md"
        } max-h-[90vh] overflow-y-auto`}
      >

          <DialogHeader>
               <DialogTitle className="text-base font-semibold text-gray-900">
                  
                  </DialogTitle>

              <DialogDescription className="text-sm text-gray-500">
                  
                  </DialogDescription>
          </DialogHeader>

        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-10 size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="size-4" />
        </button>

        {step === "input" ? renderPaymentInput() : renderReceipt()}
      </DialogContent>
    </Dialog>
  );
}
