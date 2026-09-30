"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Loader2, Trash2, X, Archive } from "lucide-react";
import { toast } from "sonner";

interface ApiError {
  response?: { data?: { message: string } };
  message?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: documentRequestInterface | null;
}

export default function DeleteRequestModal({ open, onOpenChange, document: doc }: Props) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!doc) throw new Error("No document");
      const res = await axiosInstance.delete(`/document-request/${doc._id}`);
      return res.data;
    },
    onSuccess: (data: { archived?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      if (data?.archived) {
        successAlert("Completed request archived. It remains visible in Request History.");
      } else {
        successAlert("Document request deleted successfully!");
      }
      onOpenChange(false);
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || err?.message || "Failed to delete request";
      if (typeof message === "object" && message?.message) {
        toast.error(message.message);
      } else {
        errorAlert(typeof message === "string" ? message : "Delete failed");
      }
    },
  });

  if (!doc) return null;

  const isArchivedForCompleted = doc.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm bg-white rounded-2xl p-0 gap-0">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-gray-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-rose-100 to-red-100 flex items-center justify-center shadow-sm">
                  {isArchivedForCompleted ? (
                    <Archive className="size-5 text-rose-600" />
                  ) : (
                    <Trash2 className="size-5 text-rose-600" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    {isArchivedForCompleted ? "Archive Request" : "Delete Request"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    {doc.resident?.name || doc.fullName || "Unknown"}
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
          {isArchivedForCompleted ? (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800">
              This is a completed request. Archiving soft-deletes it: it will be
              hidden from the active list but preserved in Request History for audit.
            </div>
          ) : (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700">
              Are you sure you want to delete this request? This action{" "}
              <strong>cannot be undone</strong>.
            </div>
          )}

          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1.5 text-xs text-gray-600">
            <p className="flex justify-between"><span>Document</span><strong className="text-gray-800">{doc.document}</strong></p>
            <p className="flex justify-between"><span>Status</span><strong className="text-gray-800 capitalize">{doc.status}</strong></p>
            <p className="flex justify-between"><span>Payment</span><strong className="text-gray-800">{doc.isPaid ? "Paid" : "Unpaid"}</strong></p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-5 border-t border-gray-100 bg-gray-50/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
            className="flex-1 h-10 border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="flex-1 h-10 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white font-medium disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting...
              </>
            ) : isArchivedForCompleted ? (
              <>
                <Archive className="size-4" />
                Archive
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                Delete
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}