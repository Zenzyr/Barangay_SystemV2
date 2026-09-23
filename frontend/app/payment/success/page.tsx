"use client";

import { useSearchParams } from "next/navigation";
import axiosInstance from "@/app/utils/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, Suspense } from "react";
import { CheckCircle, Download, ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { successAlert, errorAlert } from "@/app/utils/alert";

// ─── Constants ───────────────────────────────────────────────────
const BARANGAY_NAME = "Barangay Rabon";
const BARANGAY_ADDRESS = "Brgy. Rabon, Philippines";
const BARANGAY_CONTACT = "Tel: (02) 1234-5678";
const VAT_RATE = 0.12;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);

  const sender = searchParams.get("sender");
  const documentId = searchParams.get("documentId");
  const amount = searchParams.get("amount");
  const refId = searchParams.get("refId");

  // ── Payment mutation ─────────────────────────────────────────
  const paymentMutation = useMutation({
    mutationFn: async () => {
      // First, fetch the document to get the stored checkoutSessionId
      const docRes = await axiosInstance.get(`/document-request/${documentId}`);
      const doc = docRes.data;
      
      if (!doc.checkoutSessionId) {
          throw new Error("No session ID found for this document.");
      }

      // Now, proceed with payment verification using the stored ID
      await axiosInstance.post(`/document-request/${documentId}/payment/online`, {
        documentID: documentId,
        checkoutSessionId: doc.checkoutSessionId, // Use the ID from DB
      });
    },
    onSuccess: () => {
      successAlert("Payment processed successfully!");
      // Invalidate the document-requests query to force a fresh fetch
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: unknown }; message?: unknown } | null;
      const message =
        e?.response?.data || e?.message || "Failed to process payment";
      errorAlert(typeof message === "string" ? message : "Payment failed");
    },
  });

  const { mutate: processPayment } = paymentMutation;
  const hasCalledRef = useRef(false);
  const now = new Date();

  useEffect(() => {
    // Only need sender, documentId, amount to trigger
    if (sender && documentId && amount && !hasCalledRef.current) {
      hasCalledRef.current = true;
      processPayment();
    }
  }, [sender, documentId, amount, processPayment]);

  const date = now.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const day = now.toLocaleDateString("en-PH", { weekday: "long" });
  const time = now.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const baseAmount = Number(amount || 0);
  const tax = baseAmount * VAT_RATE;
  const subTotal = baseAmount - tax;
  const total = baseAmount;

  // ── Print receipt ────────────────────────────────────────────
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
        <title>Receipt</title>
        <style>
          @page { margin: 0; }
          body { margin: 0; padding: 20px; font-family: 'Courier New', monospace; background: #f5f0eb; display: flex; justify-content: center; }
          .receipt { width: 320px; background: #fffdf7; padding: 24px 20px; }
          @media print { body { background: white; padding: 0; } .receipt { box-shadow: none; } }
        </style>
      </head>
      <body><div class="receipt">${receiptHtml}</div></body>
      </html>
    `);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4 py-8 relative overflow-hidden">
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] rounded-full opacity-[0.06] blur-[120px] bg-sky-400" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl relative z-10">
        {/* ── Success Card ── */}
        <div className="relative bg-white border border-sky-100 p-8 flex flex-col items-center text-center overflow-hidden shadow-lg shadow-sky-100/30">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-10 h-10 border-t border-l border-sky-300 opacity-60 pointer-events-none" />
          <div className="absolute top-0 right-0 w-10 h-10 border-t border-r border-sky-300 opacity-60 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b border-l border-sky-300 opacity-60 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b border-r border-sky-300 opacity-60 pointer-events-none" />

          {/* Success icon */}
          <div className="relative mb-5">
            <div className="size-14 flex items-center justify-center border border-emerald-400 bg-emerald-50/50">
              <CheckCircle className="size-7 text-emerald-500" />
            </div>
          </div>

          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px w-5 bg-emerald-400" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-emerald-600 font-medium">Transaction Complete</span>
            <div className="h-px w-5 bg-emerald-400" />
          </div>

          <h1
            className="text-3xl font-light tracking-[-0.02em] text-sky-900 mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Payment Successful
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-xs">
            Your document payment has been processed and confirmed.
          </p>

          <div className="w-full border-t border-sky-100 mb-5" />

          {/* Logo + Name */}
          <div className="flex items-center gap-4 mb-6">
            <div className="size-14 border border-sky-200 overflow-hidden shrink-0 bg-white">
              <img src="/assets/logo.jpg" alt="Barangay Logo" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <p
                className="text-lg font-light tracking-wide text-sky-800"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {BARANGAY_NAME}
              </p>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-0.5">Barangay Hall</p>
            </div>
          </div>

          <button
            onClick={() => (window.location.href = "/pages/resident/myDocuments")}
            className="w-full bg-sky-50 border border-sky-200 hover:border-sky-400 text-sky-700 hover:text-sky-800 py-3 px-6 flex items-center justify-center gap-2 transition-all duration-300 group/btn"
          >
            <span className="text-[11px] uppercase tracking-[0.2em] font-medium">View My Documents</span>
            <ArrowRight size={13} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
          </button>
        </div>

        {/* ── Paper Receipt ── */}
        <div>
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs border-sky-200 text-sky-600 hover:bg-sky-50 gap-1.5"
            >
              <Printer className="size-3.5" />
              Print
            </Button>
          </div>

          <div
            ref={receiptRef}
            className="bg-[#fffdf7] border border-[#e8dcc8] shadow-lg mx-auto"
            style={{ width: "340px", fontFamily: "'Courier New', 'Courier', monospace" }}
            id="receipt"
          >
            {/* Top perforation */}
            <div className="border-b border-dashed border-[#d4c5a9] mx-4" />

            {/* Header */}
            <div className="px-5 pt-5 pb-2 text-center">
              <div className="mx-auto mb-2 size-10 border border-[#d4c5a9] overflow-hidden bg-white">
                <img src="/assets/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{BARANGAY_NAME}</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">{BARANGAY_ADDRESS}</p>
              <p className="text-[10px] text-gray-500">{BARANGAY_CONTACT}</p>
              <div className="mt-3 pt-2 border-t border-dashed border-[#d4c5a9]">
                <p className="text-[11px] font-bold text-gray-800 uppercase tracking-[0.2em]">Official Receipt</p>
              </div>
            </div>

            {/* Receipt Info */}
            <div className="px-5 py-2 space-y-1 text-[11px] text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500">Receipt No:</span>
                <span className="font-semibold text-gray-900">
                  BRGY-{now.getFullYear()}{String(now.getMonth() + 1).padStart(2, "0")}{String(now.getDate()).padStart(2, "0")}-
                  {(documentId || "").slice(-6).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Date:</span><span>{date}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Time:</span><span>{time}</span></div>
            </div>

            <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

            {/* Payer */}
            <div className="px-5 py-2 text-[11px] text-gray-700">
              <span className="text-gray-500">Payer:</span>
              <p className="font-semibold text-gray-900">{sender || "N/A"}</p>
            </div>

            <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

            {/* Items */}
            <div className="px-5 py-2">
              <div className="flex justify-between text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-700">
                <span>Document Request - #{documentId?.slice(-6).toUpperCase() || "N/A"}</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

            {/* Totals */}
            <div className="px-5 py-2 space-y-1 text-[11px]">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (excl. VAT)</span>
                <span>{formatCurrency(subTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT (12%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="border-t border-dashed border-[#d4c5a9] pt-1 flex justify-between font-bold text-gray-900 text-sm">
                <span>TOTAL</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

            {/* Payment Details */}
            <div className="px-5 py-2 space-y-1 text-[11px]">
              <div className="flex justify-between text-gray-600">
                <span>Reference No.</span>
                <span>{refId || "\u2014"}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Payment Method</span>
                <span>Online Payment</span>
              </div>
            </div>

            <div className="border-t border-dashed border-[#d4c5a9] mx-4" />

            {/* Footer */}
            <div className="px-5 py-4 text-center space-y-1">
              <p className="text-[11px] font-semibold text-gray-800">Maraming Salamat!</p>
              <p className="text-[9px] text-gray-400 italic">&quot;Sa bayanihan, tayo ay magtatagumpay.&quot;</p>
              <p className="text-[9px] text-gray-400 mt-2">This serves as your official receipt.</p>
              <p className="text-[9px] text-gray-400">Keep this for your records.</p>
              <p className="tracking-widest text-[10px] text-gray-500 mt-2">*** THANK YOU ***</p>
            </div>

            {/* Bottom perforation */}
            <div className="border-b border-dashed border-[#d4c5a9] mx-4" />
            <div className="h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
