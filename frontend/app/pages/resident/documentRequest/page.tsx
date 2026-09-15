"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { documentTypes } from "@/app/utils/documents";
import { getPublicTemplates } from "@/app/utils/documentTemplateService";
import { documentRequestInterfaceInput, documentRequestInterface } from "@/app/types/documentRequest";
import DuplicateRequestDialog from "@/components/documentRequest/DuplicateRequestDialog";
import { DocumentCard } from "@/components/documentRequest/DocumentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  ScrollText,
  BadgeCheck,
  Loader2,
  Building2,
  UserRound,
  MapPin,
  CalendarDays,
  Globe,
  Briefcase,
  Clock,
  Hash,
  Target,
  ChevronRight,
  FileCheck,
  CheckCircle2,
  ArrowLeft,
  Send,
} from "lucide-react";
import { getDocumentPrice } from "@/app/utils/documents";

// ─── Field metadata ───────────────────────────────────────────────
interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "select";
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

interface ApiError {
  response?: {
    data?: { existing?: documentRequestInterface; message?: string };
    status?: number;
  };
  message?: string;
}

const FIELD_CONFIGS: Record<string, FieldConfig> = {
  fullName: {
    key: "fullName",
    label: "Full Name",
    type: "text",
    placeholder: "e.g. Juan Dela Cruz",
    required: true,
  },
  contact: {
    key: "contact",
    label: "Contact Number",
    type: "text",
    placeholder: "e.g. 09123456789",
  },
  address: {
    key: "address",
    label: "Address",
    type: "text",
    placeholder: "e.g. 123 Barangay Rabon St.",
    required: true,
  },
  dateOfBirth: {
    key: "dateOfBirth",
    label: "Date of Birth",
    type: "date",
    required: true,
  },
  civilStatus: {
    key: "civilStatus",
    label: "Civil Status",
    type: "select",
    options: [
      { label: "Single", value: "Single" },
      { label: "Married", value: "Married" },
      { label: "Widowed", value: "Widowed" },
      { label: "Separated", value: "Separated" },
    ],
    required: true,
  },
  nationality: {
    key: "nationality",
    label: "Nationality",
    type: "text",
    placeholder: "e.g. Filipino",
    required: true,
  },
  occupation: {
    key: "occupation",
    label: "Occupation",
    type: "text",
    placeholder: "e.g. Teacher",
  },
  yrsOfResidency: {
    key: "yrsOfResidency",
    label: "Years of Residency",
    type: "number",
    placeholder: "e.g. 5",
  },
  purpose: {
    key: "purpose",
    label: "Purpose of Request",
    type: "text",
    placeholder: "e.g. Employment requirement",
    required: true,
  },
  documentNumber: {
    key: "documentNumber",
    label: "Document Number",
    type: "text",
    placeholder: "Auto-generated",
  },
  dateIssued: {
    key: "dateIssued",
    label: "Date Issued",
    type: "date",
  },
  businessName: {
    key: "businessName",
    label: "Business Name",
    type: "text",
    placeholder: "e.g. Juan's Sari-Sari Store",
    required: true,
  },
  businessAddress: {
    key: "businessAddress",
    label: "Business Address",
    type: "text",
    placeholder: "e.g. 456 Rizal St.",
    required: true,
  },
  businessType: {
    key: "businessType",
    label: "Business Type",
    type: "text",
    placeholder: "e.g. Retail, Service, Manufacturing",
    required: true,
  },
  businessNature: {
    key: "businessNature",
    label: "Nature of Business",
    type: "text",
    placeholder: "e.g. Sari-sari store, Restaurant",
    required: true,
  },
  workStatus: {
    key: "workStatus",
    label: "Employment Status",
    type: "select",
    options: [
      { label: "Working", value: "working" },
      { label: "Non-Working", value: "non working" },
      { label: "Self-Employed", value: "self employed" },
      { label: "Unemployed", value: "unemployed" },
    ],
    required: true,
  },
  workplace: {
    key: "workplace",
    label: "Workplace / Company",
    type: "text",
    placeholder: "e.g. Private Company, Barangay, Farm",
  },
  monthlyIncome: {
    key: "monthlyIncome",
    label: "Monthly Income (Php)",
    type: "number",
    placeholder: "e.g. 5000",
  },
  expenseType: {
    key: "expenseType",
    label: "Type of Unforeseen Expense",
    type: "text",
    placeholder: "e.g. Medical, Education",
    required: true,
  },
  householdExpenses: {
    key: "householdExpenses",
    label: "Monthly Household Expenses (Php)",
    type: "number",
    placeholder: "e.g. 6000",
    required: true,
  },
  assistanceTo: {
    key: "assistanceTo",
    label: "Assistance For (Name)",
    type: "text",
    placeholder: "e.g. Spouse, Family member",
  },
  titleNo: {
    key: "titleNo",
    label: "Title No.",
    type: "text",
    placeholder: "e.g. RT-025-2012002046",
    required: true,
  },
  taxDeclarationNo: {
    key: "taxDeclarationNo",
    label: "Tax Declaration No.",
    type: "text",
    placeholder: "e.g. 2013-13-0026-00026",
    required: true,
  },
  landArea: {
    key: "landArea",
    label: "Land Area (sqm)",
    type: "number",
    placeholder: "e.g. 1000",
    required: true,
  },
  treeCount: {
    key: "treeCount",
    label: "Number of Trees",
    type: "number",
    placeholder: "e.g. 3",
    required: true,
  },
  treeType: {
    key: "treeType",
    label: "Tree Type",
    type: "text",
    placeholder: "e.g. Gemelina",
    required: true,
  },
  age: {
    key: "age",
    label: "Age",
    type: "number",
    placeholder: "e.g. 21",
    required: true,
  },
  spouseName: {
    key: "spouseName",
    label: "Spouse Name",
    type: "text",
    placeholder: "e.g. Juan Dela Cruz",
  },
  annualIncome: {
    key: "annualIncome",
    label: "Annual Income (Php)",
    type: "number",
    placeholder: "e.g. 40000",
    required: true,
  },
  purok: {
    key: "purok",
    label: "Purok",
    type: "text",
    placeholder: "e.g. Purok 6",
    required: true,
  },
};

// ─── Field icon map ──────────────────────────────────────────────
const FIELD_ICONS: Record<string, React.ElementType> = {
  fullName: UserRound,
  contact: UserRound,
  address: MapPin,
  dateOfBirth: CalendarDays,
  civilStatus: UserRound,
  nationality: Globe,
  occupation: Briefcase,
  yrsOfResidency: Clock,
  purpose: Target,
  documentNumber: Hash,
  dateIssued: CalendarDays,
  businessName: Building2,
  businessAddress: MapPin,
  businessType: Building2,
  businessNature: Briefcase,
  workStatus: Briefcase,
  workplace: Building2,
  monthlyIncome: FileText,
  expenseType: FileText,
  householdExpenses: FileText,
  assistanceTo: UserRound,
  titleNo: FileText,
  taxDeclarationNo: FileText,
  landArea: FileText,
  treeCount: FileText,
  treeType: FileText,
  age: UserRound,
  spouseName: UserRound,
  annualIncome: FileText,
  purok: MapPin,
};

// ─── Document icon map ───────────────────────────────────────────
const DOCUMENT_ICONS: Record<string, React.ElementType> = {
  barangayCertificate: FileText,
  barangayClearance: FileText,
  certificateOfResidency: BadgeCheck,
  certificateOfIndigency: ScrollText,
  certificateOfGoodMoralCharacter: BadgeCheck,
  certificateOfUnemployment: ScrollText,
  barangayBusinessClearance: Building2,
  certificateOfAttestation: FileText,
  certificationOfTreesCutting: FileText,
  barangayCertification: FileText,
  certificateOfFirstTimeJobseeker: ScrollText,
  firstTimeJobseekerOath: ScrollText,
  certificateOfLowIncome: ScrollText,
  endorsementLetter: FileText,
};

// ─── Document display names ──────────────────────────────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  certificateOfGoodMoralCharacter: "Certificate of Good Moral Character",
  certificateOfUnemployment: "Certificate of Unemployment",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  certificateOfLowIncome: "Certificate of Low Income",
  endorsementLetter: "Endorsement Letter",
};

const DOCUMENT_DESCRIPTIONS: Record<string, string> = {
  barangayCertificate: "Official certification of your residency and background",
  barangayClearance: "Official certification of your residency and background",
  certificateOfResidency: "Proof that you are a resident of this barangay",
  certificateOfIndigency: "Documentation for financial or medical assistance",
  certificateOfGoodMoralCharacter: "Character reference for employment or school",
  certificateOfUnemployment: "Certification of current unemployment status",
  barangayBusinessClearance: "Permit for operating a business in the barangay",
  certificateOfAttestation: "Attestation of income and household expenses",
  certificationOfTreesCutting: "Certification for cutting trees on your land",
  barangayCertification: "Official certification of your personal details",
  certificateOfFirstTimeJobseeker: "RA 11261 certificate for first-time jobseekers",
  firstTimeJobseekerOath: "Oath of Undertaking signed under RA 11261",
  certificateOfLowIncome: "Certification of low income for assistance",
  endorsementLetter: "Endorsement letter for scholarship applicants",
};

export default function DocumentRequestPage() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  // ── State ─────────────────────────────────────────────────────
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string | number | null>>({});
  const [step, setStep] = useState<"select" | "form">("select");
  const [duplicateExisting, setDuplicateExisting] = useState<documentRequestInterface | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  // Active templates → data-driven fees
  const { data: activeTemplates = [] } = useQuery({
    queryKey: ["document-templates", "public"],
    queryFn: getPublicTemplates,
  });

  const docPrice = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of activeTemplates) {
      if (t.status === "active") map[t.documentType] = Number(t.fee) || 0;
    }
    return (document: string) =>
      map[document] ?? getDocumentPrice(document);
  }, [activeTemplates]);

  // ── Get fields for selected document ──────────────────────────
  const currentDocFields = useMemo(() => {
    if (!selectedDocument) return [];
    const doc = documentTypes.find((d) => d.document === selectedDocument);
    return doc?.fields || [];
  }, [selectedDocument]);

  // ── Pre-fill from user data ───────────────────────────────────
  const handleSelectDocument = (doc: string) => {
    setSelectedDocument(doc);
    setFormData({
      fullName: user?.name || "",
      address: user?.address || "",
      contact: user?.contact || "",
      dateOfBirth: user?.dateOfBirth || "",
      civilStatus: user?.civilStatus || "",
    });
    setStep("form");
  };

  // ── Handle field changes ──────────────────────────────────────
  const updateField = (key: string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ── Reset form ────────────────────────────────────────────────
  const resetForm = () => {
    setSelectedDocument(null);
    setFormData({});
    setStep("select");
  };

  // ── Build submit payload ──────────────────────────────────────
  const buildPayload = (): documentRequestInterfaceInput | null => {
    if (!user?._id) return null;
    if (!selectedDocument) return null;

    const payload: Record<string, unknown> = {
      resident: user._id,
      document: selectedDocument,
      price : docPrice(selectedDocument),
      status: "pending",
      isPaid: false,
      fullName: null,
      contact: null,
      address: null,
      dateOfBirth: null,
      civilStatus: null,
      nationality: null,
      occupation: null,
      yrsOfResidency: null,
      purpose: null,
      documentNumber: null,
      dateIssued: new Date().toISOString().split("T")[0],
      businessName: null,
      businessAddress: null,
      businessType: null,
      businessNature: null,
    };

    // Only include fields that are in the document's field list
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

    // Include contact if available
    if (formData.contact) payload.contact = String(formData.contact);

    return payload as unknown as documentRequestInterfaceInput;
  };

  // ── Submit mutation ───────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload) {
        throw new Error("Unable to submit document request. Please try again.");
      }
      const res = await axiosInstance.post("/document-request", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      toast.success("Document request submitted successfully!", {
        description: `Your ${DOCUMENT_NAMES[selectedDocument || ""] || "document"} request is now pending review.`,
        icon: <FileCheck className="size-5" />,
      });
      resetForm();
    },
    onError: (err: ApiError) => {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.existing) {
        setDuplicateExisting(data.existing);
        setDuplicateOpen(true);
        return;
      }
      const message =
        data?.message || err?.message || "Failed to submit document request";
      toast.error(typeof message === "string" ? message : "Submission failed", {
        description: "Please check your information and try again.",
      });
    },
  });

  // ── Validation ────────────────────────────────────────────────
  const isFormValid = useMemo(() => {
    for (const fieldKey of currentDocFields) {
      const config = FIELD_CONFIGS[fieldKey];
      if (config?.required) {
        const value = formData[fieldKey];
        if (!value || value === "") return false;
      }
    }
    return true;
  }, [currentDocFields, formData]);

  // ── Render field ──────────────────────────────────────────────
  const renderField = (fieldKey: string) => {
    const config = FIELD_CONFIGS[fieldKey];
    if (!config) return null;

    const Icon = FIELD_ICONS[fieldKey];
    const currentValue = formData[fieldKey] ?? "";

    if (config.type === "select") {
      return (
        <div key={fieldKey} className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            {Icon && <Icon className="size-3.5 text-sky-500" />}
            {config.label}
            {config.required && <span className="text-red-400">*</span>}
          </label>
          <Select
            value={String(currentValue)}
            onValueChange={(val) => updateField(fieldKey, val)}
          >
            <SelectTrigger className="w-full h-9 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 bg-white">
              <SelectValue placeholder={`Select ${config.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {config.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (config.type === "number") {
      return (
        <div key={fieldKey} className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            {Icon && <Icon className="size-3.5 text-sky-500" />}
            {config.label}
            {config.required && <span className="text-red-400">*</span>}
          </label>
          <div className="relative">
            <Input
              type="number"
              placeholder={config.placeholder}
              value={currentValue}
              onChange={(e) =>
                updateField(fieldKey, e.target.value ? Number(e.target.value) : null)
              }
              className="pl-3 h-9 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 bg-white"
              min={0}
            />
          </div>
        </div>
      );
    }

    return (
      <div key={fieldKey} className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          {Icon && <Icon className="size-3.5 text-sky-500" />}
          {config.label}
          {config.required && <span className="text-red-400">*</span>}
        </label>
        <Input
          type={config.type}
          placeholder={config.placeholder}
          value={String(currentValue)}
          onChange={(e) => updateField(fieldKey, e.target.value)}
          className="h-9 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 bg-white"
        />
      </div>
    );
  };

  // ── ── Rendering ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

  return (
    <div className="w-full min-h-dvh">
      {/* Compact Header */}
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Request a Document</h1>
        <p className="text-slate-500 mt-1">Choose the barangay document or certificate you need.</p>
        
        {step === "form" && (
           <button
             onClick={resetForm}
             className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1 mt-4"
           >
             <ArrowLeft className="size-4" />
             Back to documents
           </button>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-3 relative z-10 pb-10">
        {step === "select" ? (
          /* ── Step 1: Document Type Selection ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documentTypes.map((doc) => {
              const DocIcon = DOCUMENT_ICONS[doc.document] || FileText;
              return (
                <button
                  key={doc.document}
                  onClick={() => handleSelectDocument(doc.document)}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-sky-300 hover:shadow-lg hover:shadow-sky-100/50 transition-all duration-200 hover:-translate-y-0.5"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 to-emerald-50/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center mb-3 shadow-sm group-hover:shadow-md group-hover:from-sky-200 group-hover:to-emerald-200 transition-all duration-200">
                      <DocIcon className="size-5 text-sky-600" />
                    </div>
                    <h3 className="font-semibold text-slate-800 text-sm mb-1 group-hover:text-sky-700 transition-colors">
                      {DOCUMENT_NAMES[doc.document] || doc.document}
                    </h3>

                    <div className="absolute top-3 right-3 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      ₱{doc.price}
                    </div>
  
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {DOCUMENT_DESCRIPTIONS[doc.document] || "Request this document"}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-sky-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Select
                      <ChevronRight className="size-3" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Step 2: Form ── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-emerald-50/50">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-sm">
                      {(() => {
                        const Icon = DOCUMENT_ICONS[selectedDocument || ""] || FileText;
                        return <Icon className="size-4 text-white" />;
                      })()}
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800">
                        {DOCUMENT_NAMES[selectedDocument || ""] || "Document"}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Fill in the required fields below
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {currentDocFields.length > 0 ? (
                    currentDocFields
                      .filter((fk) => fk !== "dateIssued")
                      .map((fieldKey) => renderField(fieldKey))
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      No additional fields required for this document.
                    </div>
                  )}

                  {/* Contact (always shown since user may need to update it) */}
                  {!currentDocFields.includes("contact") && (
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <UserRound className="size-3.5 text-sky-500" />
                        Contact Number
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. 09123456789"
                        value={String(formData.contact ?? "")}
                        onChange={(e) => updateField("contact", e.target.value)}
                        className="h-9 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={!isFormValid || submitMutation.isPending}
                  className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all disabled:opacity-50"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Submit Request
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  disabled={submitMutation.isPending}
                  className="h-10 border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </Button>
              </div>
            </div>

            {/* Sidebar summary */}
            <div className="hidden lg:block">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                <div className="p-4 bg-gradient-to-r from-sky-50 to-emerald-50/50 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileCheck className="size-4 text-emerald-500" />
                    Request Summary
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="size-6 rounded-md bg-sky-100 flex items-center justify-center shrink-0">
                      {(() => {
                        const Icon = DOCUMENT_ICONS[selectedDocument || ""] || FileText;
                        return <Icon className="size-3 text-sky-600" />;
                      })()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {DOCUMENT_NAMES[selectedDocument || ""] || "Document"}
                      </p>
                      <p className="text-slate-400">Document type</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="size-6 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
                      <Clock className="size-3 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Pending</p>
                      <p className="text-slate-400">Status</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="size-6 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {currentDocFields.length} field{currentDocFields.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-slate-400">To complete</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <DuplicateRequestDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        document={duplicateExisting}
      />
    </div>
  );
}
