"use client"

import { useState, useMemo, useRef, useEffect } from "react";
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
import {
  Loader2,
  X,
  Printer,
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
const BARANGAY_NAME = "Barangay Rabon";
const BARANGAY_ADDRESS = "Brgy. Rabon, Philippines";
const BARANGAY_CONTACT = "Tel: (02) 1234-5678";

// ─── Helpers ─────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

function generateReceiptNumber(docId: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const suffix = docId.slice(-6).toUpperCase();
  return `BRGY-${year}${month}${day}-${suffix}`;
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function PaymentModal({ open, onOpenChange, document: doc }: Props) {
  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────
  const [step, setStep] = useState<"input" | "receipt">("input");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [processed, setProcessed] = useState(false);
  const [receiptDate] = useState(new Date());

  // Set initial step based on payment status
  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    if (doc?.isPaid) {
      setStep("receipt");
      setProcessed(true);
    } else {
      setStep("input");
      setAmountPaid("");
      setProcessed(false);
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
        setProcessed(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // ── Lookup price ──────────────────────────────────────────────
  const price = useMemo(() => {
    if (!doc) return 0;
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

  // ── Receipt number ────────────────────────────────────────────
  const receiptNumber = useMemo(() => {
    return doc ? generateReceiptNumber(doc._id) : "";
  }, [doc]);

  // ── Payment mutation ──────────────────────────────────────────
  const paymentMutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.patch(`/document-request/${doc?._id}/payment`, {
        isPaid: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      setProcessed(true);
      setStep("receipt");
      successAlert("Payment processed successfully!");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: unknown }; message?: unknown } | null;
      const message =
        e?.response?.data || e?.message || "Failed to process payment";
      errorAlert(typeof message === "string" ? message : "Payment failed");
    },
  });

  // ── Print receipt ─────────────────────────────────────────────
  const handlePrint = () => {
    if (!receiptRef.current) return;
    const receiptHtml = receiptRef.current.innerHTML;

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${receiptNumber}</title>
        <style>
          @page { margin: 0; }
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: 'Courier New', monospace;
            background: #f5f0eb;
            display: flex;
            justify-content: center;
          }
          .receipt { 
            width: 320px; 
            background: #fffdf7; 
            padding: 24px 20px;
          }
          @media print {
            body { background: white; padding: 0; }
            .receipt { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">${receiptHtml}</div>
      </body>
      </html>
    `);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

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

  // ── ── Render: Receipt (paper-like) ── ── ── ── ── ── ── ── ──
  const renderReceipt = () => (
    <div className="space-y-4">
      {/* Receipt Paper */}
      <div
        ref={receiptRef}
        className="bg-[#fffdf7] border border-[#e8dcc8] shadow-lg mx-auto"
        style={{ width: "340px", fontFamily: "'Courier New', 'Courier', monospace" }}
      >
        {/* ── Top perforation line ── */}
        <div className="border-b border-dashed border-[#d4c5a9] mx-4" />

        {/* Header */}
        <div className="px-5 pt-5 pb-2 text-center">
          <h2 className="text-base font-bold text-gray-800 uppercase tracking-wider">
            {BARANGAY_NAME}
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5">{BARANGAY_ADDRESS}</p>
          <p className="text-[10px] text-gray-500">{BARANGAY_CONTACT}</p>

          <div className="mt-3 pt-2 border-t border-dashed border-[#d4c5a9]">
            <p className="text-[11px] font-bold text-gray-800 uppercase tracking-[0.2em]">
              Official Receipt
            </p>
          </div>
        </div>

        {/* Receipt Info */}
        <div className="px-5 py-2 space-y-1 text-[11px] text-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-500">Receipt No:</span>
            <span className="font-semibold text-gray-900">{receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date:</span>
            <span>{formatDateTime(receiptDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Cashier:</span>
            <span>Secretary</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

        {/* Resident */}
        <div className="px-5 py-2 text-[11px] text-gray-700">
          <span className="text-gray-500">Resident:</span>
          <p className="font-semibold text-gray-900">{doc.resident?.name || doc.fullName || "N/A"}</p>
          {doc.resident?.address && (
            <p className="text-gray-500 text-[10px]">{doc.resident.address}</p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

        {/* Items */}
        <div className="px-5 py-2">
          <div className="flex justify-between text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-1.5">
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div className="flex justify-between text-[11px] text-gray-700">
            <span>{DOCUMENT_NAMES[doc.document] || doc.document}</span>
            <span>{formatCurrency(price)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

        {/* Totals */}
        <div className="px-5 py-2 space-y-1 text-[11px]">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal (excl. VAT)</span>
            <span>{formatCurrency(vatExclusive)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>VAT (12%)</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="border-t border-dashed border-[#d4c5a9] pt-1 flex justify-between font-bold text-gray-900 text-sm">
            <span>TOTAL</span>
            <span>{formatCurrency(price)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

        {/* Payment Details */}
        <div className="px-5 py-2 space-y-1 text-[11px]">
          <div className="flex justify-between text-gray-600">
            <span>Amount Paid</span>
            <span>{formatCurrency(amountPaidNum)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Change</span>
            <span>{formatCurrency(change)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-dashed border-[#d4c5a9] mx-4" />
        <div className="px-5 py-4 text-center space-y-1">
          <p className="text-[11px] font-semibold text-gray-800">Thank you!</p>
          <p className="text-[9px] text-gray-400">
            This serves as your official receipt.
          </p>
          <p className="text-[9px] text-gray-400">
            Keep this for your records.
          </p>
          {doc.documentNumber && (
            <p className="text-[9px] text-gray-500 mt-2">
              Doc Ref: {doc.documentNumber}
            </p>
          )}
        </div>

        {/* ── Bottom perforation line ── */}
        <div className="border-b border-dashed border-[#d4c5a9] mx-4" />
        <div className="h-3" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handlePrint}
          className="flex-1 h-10 gap-2 bg-gray-800 hover:bg-gray-900 text-white"
        >
          <Printer className="size-4" />
          Print Receipt
        </Button>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1 h-10 border-gray-200 text-gray-600 hover:bg-gray-50 gap-2"
        >
          <X className="size-4" />
          Close
        </Button>
      </div>
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
