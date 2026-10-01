"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptPanel } from "./ReceiptPanel";

export function ReceiptDialog({
  open,
  onOpenChange,
  requestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-gray-900">Official Receipt</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">View, print, or download this payment receipt.</DialogDescription>
        </DialogHeader>
        <ReceiptPanel requestId={requestId} enabled={open} />
      </DialogContent>
    </Dialog>
  );
}
