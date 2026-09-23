"use client";

import { documentRequestInterface } from "@/app/types/documentRequest";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X, History, Clock, CheckCircle2 } from "lucide-react";
import { DOCUMENT_NAMES, STATUS_CONFIG } from "@/app/utils/documentRequestOptions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: documentRequestInterface | null;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function StatusHistoryModal({ open, onOpenChange, document: doc }: Props) {
  if (!doc) return null;

  const history = doc.statusHistory || [];
  const fallbackEntry = history.length === 0
    ? [{ status: doc.status, at: doc.createdAt || doc.updatedAt }]
    : [];

  const entries = [...history, ...fallbackEntry];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md bg-white rounded-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shadow-sm">
                  <History className="size-5 text-indigo-600" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    Status History
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    {DOCUMENT_NAMES[doc.document] || doc.document} · {doc.resident?.name || doc.fullName || "Unknown"}
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

        <div className="p-5">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No status history recorded yet.
            </p>
          ) : (
            <ol className="relative space-y-5 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
              {entries.map((entry, i) => {
                const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
                const isFirst = i === entries.length - 1;
                return (
                  <li key={i} className="relative flex items-start gap-3">
                    <span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-white">
                      {isFirst ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : (
                        <Clock className="size-3.5 text-gray-400" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className={`text-sm font-semibold capitalize ${cfg.text}`}>
                        {cfg.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatTimestamp(entry.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}