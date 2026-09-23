"use client"

import { documentRequestInterface } from "@/app/types/documentRequest";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  X,
  FileText,
  UserRound,
  MapPin,
  CalendarDays,
  Globe,
  Briefcase,
  Clock,
  Target,
  Hash,
  Building2,
  Phone,
  BadgeInfo,
  IdCard,
  Store,
} from "lucide-react";
import {
  DOCUMENT_NAMES,
  STATUS_CONFIG,
  formatRequestDate,
  formatRequestTime,
} from "@/app/utils/documentRequestOptions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: documentRequestInterface | null;
}

// ─── Field display config ────────────────────────────────────────
const FIELD_META: Record<string, { label: string; icon: React.ElementType }> = {
  fullName:           { label: "Full Name",           icon: UserRound },
  contact:            { label: "Contact Number",      icon: Phone },
  address:            { label: "Address",             icon: MapPin },
  dateOfBirth:        { label: "Date of Birth",       icon: CalendarDays },
  civilStatus:        { label: "Civil Status",        icon: IdCard },
  nationality:        { label: "Nationality",         icon: Globe },
  occupation:         { label: "Occupation",          icon: Briefcase },
  yrsOfResidency:     { label: "Years of Residency",  icon: Clock },
  purpose:            { label: "Purpose",             icon: Target },
  documentNumber:     { label: "Document Number",     icon: Hash },
  dateIssued:         { label: "Date Issued",         icon: CalendarDays },
  businessName:       { label: "Business Name",       icon: Building2 },
  businessAddress:    { label: "Business Address",    icon: MapPin },
  businessType:       { label: "Business Type",       icon: Building2 },
  businessNature:     { label: "Nature of Business",  icon: Briefcase },
  workStatus:         { label: "Employment Status",   icon: Briefcase },
  workplace:          { label: "Workplace / Company", icon: Building2 },
  monthlyIncome:      { label: "Monthly Income",      icon: Store },
  expenseType:        { label: "Type of Unforeseen Expense", icon: Briefcase },
  householdExpenses:  { label: "Monthly Household Expenses", icon: Store },
  assistanceTo:       { label: "Assistance For",      icon: UserRound },
  titleNo:            { label: "Title No.",           icon: Hash },
  taxDeclarationNo:   { label: "Tax Declaration No.", icon: Hash },
  landArea:           { label: "Land Area (sqm)",     icon: Store },
  treeCount:          { label: "Number of Trees",     icon: Store },
  treeType:           { label: "Tree Type",           icon: Store },
  age:                { label: "Age",                 icon: UserRound },
  spouseName:         { label: "Spouse Name",         icon: UserRound },
  annualIncome:       { label: "Annual Income",       icon: Store },
  purok:              { label: "Purok",               icon: MapPin },
};

// ─── Formatter helpers ───────────────────────────────────────────
function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (key === "dateOfBirth" || key === "dateIssued") {
    const d = new Date(String(value));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }
  if (key === "yrsOfResidency") {
    const n = Number(value);
    return `${n} ${n === 1 ? "year" : "years"}`;
  }
  if (["monthlyIncome", "householdExpenses", "annualIncome", "landArea", "treeCount"].includes(key)) {
    const n = Number(value);
    if (!isNaN(n)) return String(n);
  }
  return String(value);
}

export default function RequestDetailsModal({ open, onOpenChange, document: doc }: Props) {
  if (!doc) return null;

  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;

  // Collect only non-null fields that have a FIELD_META entry
  const nonNullFields = (Object.keys(FIELD_META) as (keyof typeof FIELD_META)[])
    .filter((key) => {
      const val = (doc as unknown as Record<string, unknown>)[key];
      return val !== null && val !== undefined && val !== "";
    })
    .map((key) => ({
      key,
      label: FIELD_META[key].label,
      Icon: FIELD_META[key].icon,
      value: formatValue(key, (doc as unknown as Record<string, unknown>)[key]),
    }))
    .sort((a, b) => (a.key === "documentNumber" ? -1 : b.key === "documentNumber" ? 1 : 0));

  const requestedDate = formatRequestDate(doc);
  const requestedTime = formatRequestTime(doc);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg bg-white rounded-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        {/* ── Header ── */}
        <div className="p-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <BadgeInfo className="size-5 text-sky-600" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    Document Details
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
          {/* ── Resident info summary ── */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-sky-50 to-emerald-50/50 border border-sky-100">
            <div className="size-10 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
              <UserRound className="size-5 text-sky-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {doc.resident?.name || doc.fullName || "Unknown"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {doc.resident?.email || ""}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5 capitalize">
                  {doc.source === "walk-in" ? "Walk-in" : "Online"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Status / Payment / Date row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center space-y-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status</p>
              <p className={`text-sm font-semibold capitalize ${statusCfg.text}`}>
                {statusCfg.label}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center space-y-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Payment</p>
              <p className={`text-sm font-semibold ${doc.isPaid ? "text-emerald-600" : "text-rose-600"}`}>
                {doc.isPaid ? "Paid" : "Unpaid"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center space-y-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Requested</p>
              <p className="text-sm font-semibold text-gray-800">
                {requestedDate}
                {requestedTime ? ` · ${requestedTime}` : ""}
              </p>
            </div>
          </div>

          {/* ── Non-null fields ── */}
          {nonNullFields.length > 0 ? (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <FileText className="size-3" />
                Request Information
              </p>
              <div className="space-y-2">
                {nonNullFields.map(({ key, label, Icon, value }) => (
                  <div
                    key={key}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-sky-100 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="size-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="size-4 text-sky-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        {label}
                      </p>
                      <p className="text-sm text-gray-800 mt-0.5 break-words">
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">
              No additional information provided.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}