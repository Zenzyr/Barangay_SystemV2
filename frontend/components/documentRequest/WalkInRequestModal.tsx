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
import { DocumentFieldsForm, FIELD_CONFIGS, isFieldsValid } from "@/app/utils/documentRequestFields";
import { apiErrorMessage, formatCurrency } from "@/app/utils/transactionFormat";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Loader2,
  Building2,
  ClipboardList,
  FileText,
  AlertTriangle,
  RotateCw,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "resident" | "document" | "details";

const STEPS: { key: Step; label: string }[] = [
  { key: "resident", label: "Resident" },
  { key: "document", label: "Document" },
  { key: "details", label: "Details" },
];

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
  accountId?: string;
}

type PickerResident = {
  key: string;
  source: "account" | "census";
  id: string;
  name: string;
  email?: string;
  contact?: string;
  purok?: string;
};

interface ResidentDetails {
  id: string;
  source: "account" | "census";
  name: string;
  email: string;
  contact: string;
  address: string;
  purok: string;
  householdNumber: string;
  dateOfBirth: string;
  civilStatus: string;
  sex: string;
  age: string;
  occupation: string;
}

const RESIDENT_FIELD_KEYS = ["fullName", "contact", "address", "dateOfBirth", "civilStatus", "occupation", "age", "purok"] as const;

const clean = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  return text.toUpperCase() === "N/A" ? "" : text;
};

const ageFromDob = (dob: string): string => {
  const date = new Date(dob);
  if (!dob || isNaN(date.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age--;
  return age >= 0 && age < 130 ? String(age) : "";
};

async function fetchResidentDetails(resident: PickerResident): Promise<ResidentDetails> {
  if (resident.source === "account") {
    const { data } = await axiosInstance.get(`/account/${resident.id}`);
    const dob = clean(data.dateOfBirth);
    return {
      id: data._id,
      source: "account",
      name: clean(data.name),
      email: clean(data.email),
      contact: clean(data.contact),
      address: clean(data.address),
      purok: clean(data.purok),
      householdNumber: clean(data.houseHoldNumber),
      dateOfBirth: dob,
      civilStatus: clean(data.civilStatus),
      sex: clean(data.gender),
      age: clean(data.age) || ageFromDob(dob),
      occupation: "",
    };
  }
  const { data } = await axiosInstance.get(`/resident-census/${resident.id}`);
  const dob = clean(data.birthday);
  return {
    id: data._id,
    source: "census",
    name: clean(data.name),
    email: "",
    contact: clean(data.cellphone),
    address: "",
    purok: clean(data.purok),
    householdNumber: clean(data.householdNumber),
    dateOfBirth: dob,
    civilStatus: "",
    sex: clean(data.sex),
    age: clean(data.age) || ageFromDob(dob),
    occupation: clean(data.occupation),
  };
}

const residentFieldValue = (details: ResidentDetails, key: string): string => {
  switch (key) {
    case "fullName":
      return details.name;
    case "contact":
      return details.contact;
    case "address":
      return details.address;
    case "dateOfBirth":
      return /^\d{4}-\d{2}-\d{2}/.test(details.dateOfBirth) ? details.dateOfBirth.slice(0, 10) : "";
    case "civilStatus":
      return details.civilStatus;
    case "occupation":
      return details.occupation;
    case "age":
      return details.age;
    case "purok":
      return details.purok;
    default:
      return "";
  }
};

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("text-sm truncate", value ? "text-slate-800" : "text-slate-300 italic")}>{value || "Not on record"}</p>
    </div>
  );
}

export default function WalkInRequestModal({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("resident");
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<PickerResident | null>(null);
  const [residentSearch, setResidentSearch] = useState("");
  const [formData, setFormData] = useState<Record<string, string | number | null>>({});
  const [showReview, setShowReview] = useState(false);

  const [duplicateExisting, setDuplicateExisting] = useState<documentRequestInterface | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

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

  const { data: censusOnlyResidents = [] } = useQuery<CensusRecord[]>({
    queryKey: ["resident-census"],
    queryFn: async () => {
      const res = await axiosInstance.get("/resident-census");
      return res.data || [];
    },
    enabled: open,
  });

  const { data: activeTemplates = [] } = useQuery({
    queryKey: ["document-templates", "public"],
    queryFn: getPublicTemplates,
    enabled: open,
  });

  const {
    data: residentDetails,
    isLoading: detailsLoading,
    isError: detailsError,
    error: detailsErrorObj,
    refetch: refetchDetails,
  } = useQuery<ResidentDetails>({
    queryKey: ["walk-in", "resident-details", selectedResident?.source, selectedResident?.id],
    queryFn: () => fetchResidentDetails(selectedResident as PickerResident),
    enabled: open && !!selectedResident,
    retry: 1,
  });

  const docPrice = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of activeTemplates) {
      if (t.status === "active") map[t.documentType] = Number(t.fee) || 0;
    }
    return (document: string) =>
      map[document] ?? documentTypes.find((d) => d.document === document)?.price ?? 0;
  }, [activeTemplates]);

  const residents: PickerResident[] = useMemo(() => {
    const nameNorm = (s: string) =>
      [...new Set(
        s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
      )].sort().join(" ");
    const seen = new Set<string>();

    const out: PickerResident[] = [];
    for (const a of accountResidents) {
      seen.add(nameNorm(a.name || ""));
      out.push({
        key: `account-${a._id}`,
        source: "account",
        id: a._id,
        name: a.name,
        email: a.email,
        contact: a.contact,
        purok: a.purok,
      });
    }
    for (const c of censusOnlyResidents) {
      const key = nameNorm(c.name || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        key: `census-${c._id}`,
        source: "census",
        id: c._id,
        name: c.name,
        contact: clean(c.cellphone) || undefined,
        purok: clean(c.purok) || undefined,
      });
    }
    return out;
  }, [accountResidents, censusOnlyResidents]);

  const currentDocFields = useMemo(() => {
    if (!selectedDocument) return [];
    return (documentTypes.find((d) => d.document === selectedDocument)?.fields || []).filter((f) => f !== "dateIssued");
  }, [selectedDocument]);

  const autoValues = useMemo(() => {
    const values: Record<string, string | number> = {};
    if (!residentDetails) return values;
    for (const key of RESIDENT_FIELD_KEYS) {
      const value = residentFieldValue(residentDetails, key);
      if (!value) continue;
      values[key] = FIELD_CONFIGS[key]?.type === "number" ? Number(value) : value;
    }
    return values;
  }, [residentDetails]);

  const manualFields = useMemo(
    () => currentDocFields.filter((f) => !(f in autoValues)),
    [currentDocFields, autoValues],
  );
  const autoFilledFields = useMemo(
    () => currentDocFields.filter((f) => f in autoValues),
    [currentDocFields, autoValues],
  );

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

  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setStep("resident");
    setSelectedDocument(null);
    setSelectedResident(null);
    setResidentSearch("");
    setFormData({});
    setShowReview(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const selectResident = (r: PickerResident) => {
    if (selectedResident?.key !== r.key) {
      setFormData({});
      setShowReview(false);
    }
    setSelectedResident(r);
    setStep(selectedDocument ? "details" : "document");
  };

  const selectDocument = (document: string) => {
    if (selectedDocument !== document) {
      setFormData({});
      setShowReview(false);
    }
    setSelectedDocument(document);
    setStep("details");
  };

  const updateField = (key: string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setShowReview(false);
  };

  const buildPayload = (): documentRequestInterfaceInput | null => {
    if (!selectedDocument || !selectedResident || !residentDetails) return null;
    if (residentDetails.id !== selectedResident.id) return null;

    const payload: Record<string, unknown> = {
      document: selectedDocument,
      price: docPrice(selectedDocument),
      status: "pending",
      isPaid: false,
      source: "walk-in",
    };

    if (selectedResident.source === "account") payload.resident = residentDetails.id;
    else payload.census = residentDetails.id;

    const values = { ...autoValues, ...formData };
    if (!currentDocFields.includes("contact") && values.contact) payload.contact = String(values.contact);

    for (const fieldKey of currentDocFields) {
      const value = values[fieldKey];
      if (value === undefined || value === null || value === "") continue;
      if (fieldKey === "yrsOfResidency") {
        const n = Number(value);
        if (isNaN(n) || n < 0) continue;
        payload[fieldKey] = n;
      } else {
        payload[fieldKey] = String(value);
      }
    }
    return payload as unknown as documentRequestInterfaceInput;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload) throw new Error("Resident details are still loading. Please try again.");
      const res = await axiosInstance.post("/document-request", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
      toast.error(apiErrorMessage(err, e?.message || "Failed to submit request"));
    },
  });

  const detailsReady = !!residentDetails && residentDetails.id === selectedResident?.id;
  const isFormValid = detailsReady && isFieldsValid(currentDocFields, { ...autoValues, ...formData });
  const activeIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg bg-white rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
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

            <div className="flex items-center gap-2 mt-4">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      step === s.key
                        ? "bg-gradient-to-r from-sky-500 to-emerald-500 text-white"
                        : activeIndex > i ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                    )}
                  >
                    <span>{i + 1}</span>
                    <span>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="h-px flex-1 bg-gray-200" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
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
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {filteredResidents.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => selectResident(r)}
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

            {step === "document" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserRound className="size-4 text-sky-600 shrink-0" />
                    <p className="text-sm font-medium text-slate-800 truncate">{selectedResident?.name}</p>
                  </div>
                  <button onClick={() => setStep("resident")} className="shrink-0 text-xs font-medium text-sky-600 hover:text-sky-700">
                    Change
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {documentTypes.map((doc) => {
                    const DocIcon = DOCUMENT_ICONS[doc.document] || FileText;
                    return (
                      <button
                        key={doc.document}
                        onClick={() => selectDocument(doc.document)}
                        className={cn(
                          "group bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-sky-300 hover:shadow-md hover:shadow-sky-100/50 transition-all duration-200",
                          selectedDocument === doc.document && "border-sky-300 ring-1 ring-sky-200"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="size-9 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center">
                            <DocIcon className="size-4 text-sky-600" />
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {formatCurrency(docPrice(doc.document))}
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
              </div>
            )}

            {step === "details" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-sky-50/70 to-emerald-50/40 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <BadgeCheck className="size-4 text-emerald-600 shrink-0" />
                      <p className="text-sm font-semibold text-slate-800 truncate">Resident Details</p>
                      {selectedResident?.source === "census" && (
                        <span className="shrink-0 text-[10px] rounded-full bg-violet-50 px-1.5 py-0.5 font-medium text-violet-600">Census</span>
                      )}
                    </div>
                    <button onClick={() => setStep("resident")} className="shrink-0 text-xs font-medium text-sky-600 hover:text-sky-700">
                      Change
                    </button>
                  </div>
                  <div className="p-4">
                    {detailsLoading ? (
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="space-y-1.5">
                            <Skeleton className="h-2.5 w-16" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                        ))}
                      </div>
                    ) : detailsError || !detailsReady ? (
                      <div className="flex flex-col items-center text-center gap-2 py-4">
                        <AlertTriangle className="size-5 text-rose-500" />
                        <p className="text-sm font-medium text-slate-700">Resident information could not be loaded</p>
                        <p className="text-xs text-slate-500">{apiErrorMessage(detailsErrorObj, "Please try again or choose another resident.")}</p>
                        <Button variant="outline" size="sm" onClick={() => refetchDetails()} className="mt-1 gap-1.5 border-slate-200">
                          <RotateCw className="size-3.5" /> Retry
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div className="col-span-2">
                          <DetailItem label="Full Name" value={residentDetails.name} />
                        </div>
                        <DetailItem label={residentDetails.source === "census" ? "Census ID" : "Resident ID"} value={residentDetails.id.slice(-8).toUpperCase()} />
                        <DetailItem label="Household No." value={residentDetails.householdNumber} />
                        <div className="col-span-2">
                          <DetailItem label="Address" value={residentDetails.address} />
                        </div>
                        <DetailItem label="Purok" value={residentDetails.purok} />
                        <DetailItem label="Contact" value={residentDetails.contact} />
                        <DetailItem label="Date of Birth" value={residentDetails.dateOfBirth} />
                        <DetailItem label="Age" value={residentDetails.age} />
                        <DetailItem label="Civil Status" value={residentDetails.civilStatus} />
                        <DetailItem label="Sex" value={residentDetails.sex} />
                        {residentDetails.email && (
                          <div className="col-span-2">
                            <DetailItem label="Email" value={residentDetails.email} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

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
                        Walk-in · {formatCurrency(selectedDocument ? docPrice(selectedDocument) : 0)}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setStep("document")} className="shrink-0 text-xs font-medium text-sky-600 hover:text-sky-700">
                    Change
                  </button>
                </div>

                {detailsReady && (
                  <>
                    {autoFilledFields.length > 0 && (
                      <p className="text-xs text-slate-500">
                        Auto-filled from the resident&apos;s record:{" "}
                        <span className="text-slate-700">{autoFilledFields.map((f) => FIELD_CONFIGS[f]?.label || f).join(", ")}</span>
                      </p>
                    )}
                    {manualFields.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">Request Details</p>
                        <DocumentFieldsForm fields={manualFields} values={formData} onChange={updateField} />
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        No additional details are needed for this document.
                      </p>
                    )}

                    {showReview ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 space-y-3">
                        <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                          <ClipboardList className="size-4" />
                          Review & Confirm
                        </p>
                        <div className="rounded-lg bg-white border border-emerald-100 p-3 space-y-1.5 text-xs text-slate-600">
                          <p className="flex justify-between gap-3"><span>Resident</span><strong className="text-slate-800 text-right">{residentDetails?.name}</strong></p>
                          <p className="flex justify-between gap-3"><span>Document</span><strong className="text-slate-800 text-right">{DOCUMENT_NAMES[selectedDocument || ""]}</strong></p>
                          <p className="flex justify-between gap-3"><span>Source</span><strong className="text-slate-800">Walk-in</strong></p>
                          <p className="flex justify-between gap-3"><span>Price</span><strong className="text-slate-800">{formatCurrency(selectedDocument ? docPrice(selectedDocument) : 0)}</strong></p>
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
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100 bg-gray-50/50">
            <Button
              variant="outline"
              onClick={() => {
                if (step === "details") {
                  setShowReview(false);
                  setStep("document");
                } else if (step === "document") {
                  setStep("resident");
                } else {
                  onOpenChange(false);
                }
              }}
              className="h-10 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" />
              {step === "details" ? "Change Document" : step === "document" ? "Change Resident" : "Cancel"}
            </Button>

            {step === "details" && showReview && (
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !detailsReady}
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
