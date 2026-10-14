"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { TransactionItem } from "@/app/types/transaction.type";
import { formatCurrency, apiErrorMessage } from "@/app/utils/transactionFormat";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Banknote, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionItem | null;
}

export function RecordPaymentDialog({ open, onOpenChange, transaction }: Props) {
  const queryClient = useQueryClient();
  const [tendered, setTendered] = useState("");

  const amountDue = transaction?.amount ?? 0;
  const tenderedValue = Number(tendered);
  const isValid = tendered !== "" && Number.isFinite(tenderedValue) && tenderedValue >= amountDue;
  const change = useMemo(
    () => (isValid ? Math.round((tenderedValue - amountDue) * 100) / 100 : 0),
    [isValid, tenderedValue, amountDue],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error("No transaction selected");
      const res = await axiosInstance.patch(`/document-request/${transaction._id}/payment`, {
        isPaid: true,
        amountTendered: tenderedValue,
      });
      return res.data as { receiptNumber?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      onOpenChange(false);
      setTendered("");
      successAlert(
        `Payment recorded and verified successfully${change ? ` (change: ${formatCurrency(change)})` : ""}. Receipt No. ${
          data.receiptNumber ?? "N/A"
        }.`,
      );
    },
    onError: (err) => {
      errorAlert(apiErrorMessage(err, "Failed to record payment"));
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) setTendered("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5 text-emerald-600" />
            Record Payment
          </DialogTitle>
          <DialogDescription>Collect the payment for this document request.</DialogDescription>
        </DialogHeader>

        {transaction && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Resident</span>
                <span className="font-medium text-slate-800 text-right">{transaction.residentName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Document</span>
                <span className="font-medium text-slate-800 text-right">{transaction.documentName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Reference No.</span>
                <span className="font-medium text-slate-800 text-right">{transaction.transactionNumber}</span>
              </div>
              <div className="flex justify-between gap-2 border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-medium">Amount Due</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(amountDue)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Amount Tendered</label>
              <Input
                type="number"
                min={0}
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder={`e.g. ${amountDue.toFixed(2)}`}
                className="h-9 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20"
              />
              {tendered !== "" && Number.isFinite(tenderedValue) && tenderedValue < amountDue && (
                <p className="text-xs text-rose-600">Amount tendered is less than the amount due.</p>
              )}
            </div>

            {isValid && (
              <div className="flex justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm">
                <span className="text-emerald-700 font-medium">Change</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(change)}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
                className="border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!isValid || mutation.isPending}
                className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Record Payment
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}