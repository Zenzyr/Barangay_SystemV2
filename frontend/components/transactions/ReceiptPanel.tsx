"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { ReceiptData } from "@/app/types/transaction.type";
import { apiErrorMessage } from "@/app/utils/transactionFormat";
import { exportElementToFittedPdf, printElementAsImage } from "@/app/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptView } from "./ReceiptView";
import { AlertTriangle, Download, Loader2, Printer, RotateCw } from "lucide-react";
import { toast } from "sonner";

export function useReceipt(requestId: string | null | undefined, enabled = true) {
  return useQuery<ReceiptData>({
    queryKey: ["transactions", "receipt", requestId],
    queryFn: async () => (await axiosInstance.get(`/transactions/${requestId}/receipt`)).data,
    enabled: !!requestId && enabled,
    retry: false,
  });
}

export function ReceiptPanel({ requestId, enabled = true, actions }: { requestId: string | null | undefined; enabled?: boolean; actions?: React.ReactNode }) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"print" | "download" | null>(null);
  const { data: receipt, isLoading, isError, error, refetch } = useReceipt(requestId, enabled);

  const run = async (kind: "print" | "download") => {
    if (!receiptRef.current || !receipt) return;
    setBusy(kind);
    try {
      if (kind === "print") await printElementAsImage(receiptRef.current, `Receipt ${receipt.receiptNumber}`);
      else await exportElementToFittedPdf(receiptRef.current, `receipt-${receipt.receiptNumber}.pdf`, `Receipt ${receipt.receiptNumber}`);
    } catch {
      toast.error(kind === "print" ? "Failed to print the receipt" : "Failed to download the receipt");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 flex flex-col items-center">
        <Skeleton className="h-[460px] w-[340px] rounded-none" />
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" /> Loading receipt...
        </p>
      </div>
    );
  }

  if (isError || !receipt) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-10 px-4">
        <div className="size-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Receipt unavailable</p>
          <p className="text-xs text-gray-500 mt-1">{apiErrorMessage(error, "The receipt could not be loaded.")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 border-gray-200">
          <RotateCw className="size-3.5" /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReceiptView ref={receiptRef} receipt={receipt} />
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={() => run("print")} disabled={!!busy} className="flex-1 h-10 gap-2 bg-gray-800 hover:bg-gray-900 text-white">
          {busy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
          Print
        </Button>
        <Button variant="outline" onClick={() => run("download")} disabled={!!busy} className="flex-1 h-10 gap-2 border-gray-200 text-gray-700">
          {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download PDF
        </Button>
        {actions}
      </div>
    </div>
  );
}
