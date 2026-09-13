"use client";

import { useState } from "react";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import RequestDetailsModal from "./RequestDetailsModal";
import { AlertTriangle, X, Eye, UserRound, FileText, Clock } from "lucide-react";
import { DOCUMENT_NAMES, formatRequestDate, formatRequestTime } from "@/app/utils/documentRequestOptions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The existing duplicate request returned by the backend (409 body.existing). */
  document: documentRequestInterface | null;
}

export default function DuplicateRequestDialog({ open, onOpenChange, document: existing }: Props) {
  const [viewing, setViewing] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm bg-white rounded-2xl p-0 gap-0">
          {/* Header */}
          <div className="p-5 pb-4 border-b border-gray-100">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-sm">
                    <AlertTriangle className="size-5 text-amber-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-semibold text-gray-900">
                      Duplicate Request Detected
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500">
                      {existing ? DOCUMENT_NAMES[existing.document] || existing.document : "A similar request already exists"}
                    </DialogDescription>
                  </div>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              A request with the <strong>same resident, document type, date and time</strong> was already submitted.
              Please review the existing request below or cancel this one.
            </p>

            {existing && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2 text-xs text-gray-600">
                <p className="flex items-center gap-2">
                  <UserRound className="size-3.5 text-sky-500 shrink-0" />
                  <span className="truncate">{existing.resident?.name || "Unknown"}</span>
                </p>
                <p className="flex items-center gap-2">
                  <FileText className="size-3.5 text-sky-500 shrink-0" />
                  <span className="truncate">{DOCUMENT_NAMES[existing.document] || existing.document}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="size-3.5 text-sky-500 shrink-0" />
                  <span>
                    {formatRequestDate(existing)}
                    {formatRequestTime(existing) ? ` · ${formatRequestTime(existing)}` : ""}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-5 border-t border-gray-100 bg-gray-50/50">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              disabled={!existing}
              onClick={() => {
                onOpenChange(false);
                setViewing(true);
              }}
              className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium disabled:opacity-50"
            >
              <Eye className="size-4" />
              View Existing Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {existing && (
        <RequestDetailsModal
          open={viewing}
          onOpenChange={setViewing}
          document={existing}
        />
      )}
    </>
  );
}