"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { documentRequestInterfaceInput } from "@/app/types/documentRequest";
import { accountInterface } from "@/app/types/account.type";
import { documentTypes } from "@/app/utils/documents";
import { getPublicTemplates } from "@/app/utils/documentTemplateService";
import {
  DOCUMENT_NAMES,
  DOCUMENT_DESCRIPTIONS,
  DOCUMENT_ICONS,
} from "@/app/utils/documentRequestOptions";
import { DocumentFieldsForm, isFieldsValid } from "@/app/utils/documentRequestFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import DuplicateRequestDialog from "./DuplicateRequestDialog";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { successAlert } from "@/app/utils/alert";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Store,
  Search,
  UserRound,
  FileCheck,
  Loader2,
  Building2,
  ClipboardList,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select" | "resident" | "form";

interface CensusRecord {
  _id: string;
  name: string;
  sex: string;
  birthday: string | number;
  age: string | number;
  occupation: string;
  education: string;
  purok: string;
  householdNumber: string;
  cellphone: string;
}

/**
 * Union of the two resident sources shown in the walk-in picker:
 *  - account → a resident with a (approved) user account; these link via `resident`
 *  - census  → a resident who exists ONLY in the barangay census; no account
 *    exists, so the request is stored purely from the snapshot fields
 */
type PickerResident = {
  key: string;
  source: "account" | "census";
  id: string;
  name: string;
  email?: string;
  contact?: string;
  address?: string;
  dateOfBirth?: string;
  civilStatus?: string;
  purok?: string;
  sex?: string;
  age?: string | number;
};

export default function WalkInRequestModal({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("select");
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<PickerResident | null>(null);
  const [residentSearch, setResidentSearch] = useState("");
  const [formData, setFormData] = useState<Record<string, string | number | null>>({});
  const [showReview, setShowReview] = useState(false);

  // Duplicate request handling (409)
  const [duplicateExisting, setDuplicateExisting] = useState<documentRequestInterface | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  // Account-linked approved residents
  const { data: accountResidents = [], isLoading: residentsLoading } = useQuery<accountInterface[]>({
    queryKey: ["accounts", "approved"],
    queryFn: async () => {
      const res = await axiosInstance.get("/account", {
        params: { status: "approved" },
      });
      return (res.data || []).filter((a: accountInterface) => a.role === "resident");
    },
    enabled: open,
  });

  // Census-only residents (people in the census who never registered an account)
  const { data: censusOnlyResidents = [] } = useQuery<CensusRecord[]>({
    queryKey: ["resident-census"],
    queryFn: async () => {
      const res = await axiosInstance.get("/resident-census");
      return res.data || [];
    },
    enabled: open,
  });

  // Active document templates → authoritative fees (falls back to the
  // hardcoded layout prices so legacy document types keep a price).
  const { data: activeTemplates = [] } = useQuery({
    queryKey: ["document-templates", "public"],
    queryFn: getPublicTemplates,
    enabled: open,
  });

  const docPrice = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of activeTemplates) {
      if (t.status === "active") map[t.documentType] = Number(t.fee) || 0;
    }
    return (document: string) =>
      map[document] ?? documentTypes.find((d) => d.document === document)?.price ?? 0;
  }, [activeTemplates]);

  // Merge both sources into a single picker list, deduplicated by
  // normalized name (accounts take precedence over census-only entries).
  const residents: PickerResident[] = useMemo(() => {
    // Order- and duplicate-insensitive token key: "Munar,Orlando Munar" and
    // "Orlando Munar" resolve to the same key, so one person is not shown
    // twice even when the census and account spell the name differently.
    const nameNorm = (s: string) =>
      [...new Set(
        s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
      )].sort().join(" ");
    const seen = new Set<string>();

    const out: PickerResident[] = [];
    for (const a of accountResidents) {
      const key = nameNorm(a.name || "");
      seen.add(key);
      out.push({
        key: `account-${a._id}`,
        source: "account",
        id: a._id,
        name: a.name,
        email: a.email,
        contact: a.contact,
        address: a.address,
        dateOfBirth: a.dateOfBirth,
        civilStatus: a.civilStatus,
        purok: a.purok,
      });
    }
    for (const c of censusOnlyResidents) {
      // Compare by a normalized token key so "Dela Cruz,Juan" and
      // "Juan Dela Cruz" from the two sources can be deduplicated, but keep
      // the ORIGINAL census spelling for display and for the document snapshot.
      const key = nameNorm(c.name || "");
      if (seen.has(key)) continue;
      if (!key) continue;
      seen.add(key);
      out.push({
        key: `census-${c._id}`,
        source: "census",
        id: c._id,
        name: c.name,
        contact: c.cellphone !== "N/A" ? c.cellphone : undefined,
        purok: c.purok !== "N/A" ? c.purok : undefined,
        dateOfBirth: c.birthday !== "N/A" ? String(c.birthday) : undefined,
        sex: c.sex !== "N/A" ? c.sex : undefined,
        age: c.age !== "N/A" ? c.age : undefined,
      });
    }
    return out;
  }, [accountResidents, censusOnlyResidents]);

  const currentDocFields = useMemo(() => {
    if (!selectedDocument) return [];
    return documentTypes.find((d) => d.document === selectedDocument)?.fields || [];
  }, [selectedDocument]);

  const filteredResidents = useMemo(() => {
    const q = residentSearch.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const email = (r.email || "").toLowerCase();
      const contact = (r.contact || "").toLowerCase();
      return name.includes(q) || email.includes(q) || contact.includes(q);
    });
  }, [residents, residentSearch]);

  // Reset state when the dialog opens
  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setStep("select");
    setSelectedDocument(null);
    setSelectedResident(null);
    setResidentSearch("");
    setFormData({});
    setShowReview(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const updateField = (key: string, value: string | number | null) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const buildPayload = (): documentRequestInterfaceInput | null => {
    if (!selectedDocument || !selectedResident) return null;
    const payload: Record<string, unknown> = {
      document: selectedDocument,
      price: docPrice(selectedDocument),
      status: "pending",
      isPaid: false,
      source: "walk-in",
    };

    // Account-linked resident → store the account ref. Census-only resident
    // → no account exists, so the request is filed from the denormalized
    // snapshot fields kept on the document itself.
    if (selectedResident.source === "account") {
      payload.resident = selectedResident.id;
      payload.contact = selectedResident.contact || null;
    } else {
      payload.fullName = formData.fullName || selectedResident.name;
      payload.contact = formData.contact || selectedResident.contact || null;
      payload.dateOfBirth = formData.dateOfBirth || selectedResident.dateOfBirth || null;
      payload.purok = formData.purok || selectedResident.purok || null;
      payload.age = formData.age ?? selectedResident.age ?? null;
    }

    for (const fieldKey of currentDocFields) {
      const value = formData[fieldKey];
      if (value !== undefined && value !== null && value !== "") {
        if (fieldKey === "yrsOfResidency") {
          const n = Number(value);
          if (isNaN(n) || n < 0) continue;
          payload[fieldKey] = n;
        } else {
          payload[fieldKey] = String(value);
        }
      }
    }
    return payload as unknown as documentRequestInterfaceInput;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload) throw new Error("Unable to submit walk-in request.");
      const res = await axiosInstance.post("/document-request", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      successAlert("Walk-in request submitted successfully!");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const e = err as
        | { response?: { status?: number; data?: { existing?: unknown; message?: string } }; message?: string }
        | null;
      const data = e?.response?.data;
      if (e?.response?.status === 409 && data?.existing) {
        setDuplicateExisting(data.existing as documentRequestInterface);
        setDuplicateOpen(true);
        return;
      }
      const message = data?.message || e?.message || "Failed to submit request";
      toast.error(typeof message === "string" ? message : "Submission failed");
    },
  });

  const isFormValid = isFieldsValid(currentDocFields, formData);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg bg-white rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
          {/* ── Header ── */}
          <div className="p-5 pb-4 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-emerald-50/50">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-sm">
                    <Store className="size-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-semibold text-gray-900">
                      Walk-in Request
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500">
                      Process a document request on behalf of a resident
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

            {/* Stepper */}
            <div className="flex items-center gap-2 mt-4">
              {(
                [
                  { key: "select", label: "Document" },
                  { key: "resident", label: "Resident" },
                  { key: "form", label: "Details" },
                ] as { key: Step; label: string }[]
              ).map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      step === s.key
                        ? "bg-gradient-to-r from-sky-500 to-emerald-500 text-white"
                        : (stepIndex(step) > i ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400")
                    )}
                  >
                    <span>{i + 1}</span>
                    <span>{s.label}</span>
                  </div>
                  {i < 2 && <div className="h-px flex-1 bg-gray-200" />}
                </div>
              ))}
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto p-5">
            {step === "select" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documentTypes.map((doc) => {
                  const DocIcon = DOCUMENT_ICONS[doc.document] || FileText;
                  return (
                    <button
                      key={doc.document}
                      onClick={() => {
                        setSelectedDocument(doc.document);
                        setFormData({});
                        setShowReview(false);
                        setStep("resident");
                      }}
                      className="group bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-sky-300 hover:shadow-md hover:shadow-sky-100/50 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="size-9 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center">
                          <DocIcon className="size-4 text-sky-600" />
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          ₱{doc.price}
                        </span>
                      </div>
                      <h3 className="mt-3 font-semibold text-slate-800 text-sm group-hover:text-sky-700 transition-colors">
                        {DOCUMENT_NAMES[doc.document] || doc.document}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {DOCUMENT_DESCRIPTIONS[doc.document] || "Request this document"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {step === "resident" && (
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                    <UserRound className="size-3.5 text-sky-500" />
                    Select Resident
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, email, or contact..."
                      value={residentSearch}
                      onChange={(e) => setResidentSearch(e.target.value)}
                      className="pl-9 h-10 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  {residentsLoading ? (
                    <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Loading residents...
                    </div>
                  ) : filteredResidents.length === 0 ? (
                    <div className="text-center py-10 text-sm text-gray-400">
                      No residents found. Try a different search term.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {filteredResidents.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => {
                            setSelectedResident(r);
                            // Prefill form fields from the selected resident
                            // so the secretary doesn't have to retype everything.
                            const prefill: Record<string, string | number | null> = {};
                            if (r.source === "census") {
                              if (r.name) prefill.fullName = r.name;
                              if (r.contact) prefill.contact = r.contact;
                              if (r.dateOfBirth) prefill.dateOfBirth = r.dateOfBirth;
                              if (r.purok) prefill.purok = r.purok;
                              if (r.age && r.age !== "N/A") prefill.age = Number(r.age);
                            } else if (r.contact) {
                              prefill.contact = r.contact;
                            }
                            setFormData((p) => ({ ...p, ...prefill }));
                            setStep("form");
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sky-50",
                            selectedResident?.key === r.key && "bg-sky-50"
                          )}
                        >
                          <div className="size-9 shrink-0 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center">
                            <UserRound className="size-4 text-sky-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                              {r.source === "census" && (
                                <span className="shrink-0 text-[10px] rounded-full bg-violet-50 px-1.5 py-0.5 font-medium text-violet-600">Census</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {r.source === "census" ? (r.purok || "Census record") : (r.email || "")}
                            </p>
                          </div>
                          {r.contact && (
                            <span className="text-[11px] text-slate-400 shrink-0">{r.contact}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === "form" && (
              <div className="space-y-5">
                {/* Selected summary */}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 shrink-0 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center">
                      {(() => {
                        const Icon = DOCUMENT_ICONS[selectedDocument || ""] || FileText;
                        return <Icon className="size-4 text-sky-600" />;
                      })()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {DOCUMENT_NAMES[selectedDocument || ""] || "Document"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {selectedResident?.name || ""} · Walk-in
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep("resident")}
                    className="shrink-0 text-xs font-medium text-sky-600 hover:text-sky-700"
                  >
                    Change
                  </button>
                </div>

                <DocumentFieldsForm
                  fields={currentDocFields.filter((f) => f !== "dateIssued")}
                  values={formData}
                  onChange={updateField}
                />
                {!currentDocFields.includes("contact") && (
                  <DocumentFieldsForm fields={["contact"]} values={formData} onChange={updateField} />
                )}

                {showReview ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 space-y-3">
                    <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                      <ClipboardList className="size-4" />
                      Review & Confirm
                    </p>
                    <div className="rounded-lg bg-white border border-emerald-100 p-3 space-y-1.5 text-xs text-slate-600">
                      <p className="flex justify-between gap-3"><span>Resident</span><strong className="text-slate-800 text-right">{selectedResident?.name}</strong></p>
                      <p className="flex justify-between gap-3"><span>Document</span><strong className="text-slate-800 text-right">{DOCUMENT_NAMES[selectedDocument || ""]}</strong></p>
                      <p className="flex justify-between gap-3"><span>Source</span><strong className="text-slate-800">Walk-in</strong></p>
                      <p className="flex justify-between gap-3"><span>Price</span><strong className="text-slate-800">₱{selectedDocument ? docPrice(selectedDocument) : 0}</strong></p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReview(true)}
                    disabled={!isFormValid}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    Continue to Review
                    <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100 bg-gray-50/50">
            <Button
              variant="outline"
              onClick={() => {
                if (step === "form") {
                  setShowReview(false);
                  setStep("resident");
                } else if (step === "resident") {
                  setStep("select");
                } else {
                  onOpenChange(false);
                }
              }}
              className="h-10 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" />
              {step === "form" ? "Change Resident" : step === "resident" ? "Change Document" : "Cancel"}
            </Button>

            {step === "form" && showReview && (
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium disabled:opacity-50"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Building2 className="size-4" />
                    Submit Walk-in Request
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DuplicateRequestDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        document={duplicateExisting}
      />
    </>
  );
}

function stepIndex(step: Step): number {
  return step === "select" ? 0 : step === "resident" ? 1 : 2;
}