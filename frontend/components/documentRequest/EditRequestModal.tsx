"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import {
  documentRequestInterface,
} from "@/app/types/documentRequest";
import { documentTypes } from "@/app/utils/documents";
import { DocumentFieldsForm, isFieldsValid } from "@/app/utils/documentRequestFields";
import { DOCUMENT_NAMES } from "@/app/utils/documentRequestOptions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Loader2, PencilLine, X, Lock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: documentRequestInterface | null;
  /** role of the current user: "resident" | "secretary" | undefined */
  role?: string;
}

export default function EditRequestModal({ open, onOpenChange, document: doc, role }: Props) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string | number | null>>({});

  const docFields = useMemo(() => {
    if (!doc) return [];
    return documentTypes.find((d) => d.document === doc.document)?.fields || [];
  }, [doc]);

  useEffect(() => {
    if (doc) {
      const initial: Record<string, string | number | null> = {};
      for (const key of docFields) {
        initial[key] = (doc as any)[key] ?? "";
      }
      if (!docFields.includes("contact")) initial.contact = doc.contact ?? "";
      setFormData(initial);
    } else {
      setFormData({});
    }
  }, [doc, docFields, open]);

  // Status-based editability: residents may edit pending/rejected;
  // secretaries may also edit processing.
  const editable =
    role === "secretary"
      ? ["pending", "processing", "rejected"].includes(doc?.status || "")
      : ["pending", "rejected"].includes(doc?.status || "");

  const updateField = (key: string, value: string | number | null) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!doc) throw new Error("No document");
      const payload: Record<string, string | number> = {};
      for (const fk of docFields) {
        const v = formData[fk];
        if (v !== null && v !== undefined && v !== "")
          payload[fk] = fk === "yrsOfResidency" ? Number(v) : String(v);
      }
      if (!docFields.includes("contact")) {
        const c = formData.contact;
        if (c) payload.contact = String(c);
      }
      const res = await axiosInstance.put(`/document-request/${doc._id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      successAlert("Document request updated successfully!");
      onOpenChange(false);
    },
    onError: (err: any) => {
      const message = err?.response?.data || err?.message || "Failed to update request";
      if (typeof message === "object" && message?.message) {
        toast.error(message.message);
      } else {
        errorAlert(typeof message === "string" ? message : "Update failed");
      }
    },
  });

  if (!doc) return null;

  const formValid = isFieldsValid(docFields, formData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg bg-white rounded-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <PencilLine className="size-5 text-sky-600" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    Edit Request
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    {DOCUMENT_NAMES[doc.document] || doc.document}
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

        <div className="p-5 space-y-5">
          {!editable ? (
            <div className="flex flex-col items-center gap-3 text-center py-8">
              <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Lock className="size-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">This request can no longer be edited</p>
                <p className="text-xs text-gray-500 mt-1">
                  Requests that are to claim or completed are locked. Please contact the barangay secretary for changes.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
                Current status: <strong className="capitalize">{doc.status}</strong>. You can update the details below.
              </div>
              <DocumentFieldsForm
                fields={docFields.filter((f) => f !== "dateIssued")}
                values={formData}
                onChange={updateField}
              />
              {!docFields.includes("contact") && (
                <div className="mt-4">
                  <DocumentFieldsForm fields={["contact"]} values={formData} onChange={updateField} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 p-5 border-t border-gray-100 bg-gray-50/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!editable || !formValid || updateMutation.isPending}
            className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <PencilLine className="size-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}