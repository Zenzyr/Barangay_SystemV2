"use client";

import { useSearchParams } from "next/navigation";
import axiosInstance from "@/app/utils/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, Suspense } from "react";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { ReceiptPanel } from "@/components/transactions/ReceiptPanel";

// ─── Constants ───────────────────────────────────────────────────
const BARANGAY_NAME = "Barangay Rabon";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const sender = searchParams.get("sender");
  const documentId = searchParams.get("documentId");
  const amount = searchParams.get("amount");

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
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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

  useEffect(() => {
    // Only need sender, documentId, amount to trigger
    if (sender && documentId && amount && !hasCalledRef.current) {
      hasCalledRef.current = true;
      processPayment();
    }
  }, [sender, documentId, amount, processPayment]);

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
          {paymentMutation.isPending || (paymentMutation.isIdle && sender && documentId && amount) ? (
            <div className="h-full min-h-[320px] bg-white border border-sky-100 flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-5 animate-spin text-sky-500" />
              Confirming your payment...
            </div>
          ) : paymentMutation.isError || paymentMutation.isIdle ? (
            <div className="h-full min-h-[320px] bg-white border border-rose-100 flex flex-col items-center justify-center gap-2 text-center px-6">
              <p className="text-sm font-medium text-rose-600">We could not confirm this payment yet.</p>
              <p className="text-xs text-slate-500">Your receipt will appear in My Transactions once the payment is verified.</p>
            </div>
          ) : (
            <ReceiptPanel requestId={documentId} />
          )}
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
