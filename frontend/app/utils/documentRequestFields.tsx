"use client";

import {
  UserRound,
  MapPin,
  CalendarDays,
  Globe,
  Briefcase,
  Clock,
  Target,
  Hash,
  Building2,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FIELD_MAX_LENGTHS,
  PROFILE_FIELD_KEYS,
  TITLE_NO_PREFIX,
  documentFieldError,
  isFieldRequired,
  normalizeTitleNo,
  stripTitlePrefix,
} from "@/app/utils/documentRequestValidation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Field metadata ───────────────────────────────────────────────
export interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "select";
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

export const FIELD_CONFIGS: Record<string, FieldConfig> = {
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
  spouseDateOfBirth: {
    key: "spouseDateOfBirth",
    label: "Partner Date of Birth",
    type: "date",
    required: true,
  },
  cohabitationYear: {
    key: "cohabitationYear",
    label: "Living Together Since (Year)",
    type: "number",
    placeholder: "e.g. 2021",
    required: true,
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

// ─── Field icon map ───────────────────────────────────────────────
export const FIELD_ICONS: Record<string, React.ElementType> = {
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
  monthlyIncome: Briefcase,
  expenseType: Briefcase,
  householdExpenses: Briefcase,
  assistanceTo: UserRound,
  titleNo: FileText,
  taxDeclarationNo: FileText,
  landArea: FileText,
  treeCount: FileText,
  treeType: FileText,
  age: UserRound,
  spouseName: UserRound,
  spouseDateOfBirth: CalendarDays,
  cohabitationYear: CalendarDays,
  annualIncome: FileText,
  purok: MapPin,
};

interface DocumentFieldsFormProps {
  fields: string[];
  values: Record<string, string | number | null>;
  onChange: (key: string, value: string | number | null) => void;
  document?: string | null;
}

export function TitleNoInput({
  value,
  onChange,
  invalid,
  className,
  id,
}: {
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  invalid?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-slate-500">
        {TITLE_NO_PREFIX}
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="e.g. 025-2012002046"
        value={stripTitlePrefix(String(value ?? ""))}
        onChange={(e) => onChange(normalizeTitleNo(e.target.value))}
        maxLength={FIELD_MAX_LENGTHS.titleNo - TITLE_NO_PREFIX.length}
        aria-invalid={invalid || undefined}
        className={`pl-10 ${className ?? ""}`}
      />
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-500">
      {message}
    </p>
  );
}

/**
 * Renders the Input/Select controls for the given field keys using the shared
 * FIELD_CONFIGS. Used by the resident request wizard, the walk-in modal and
 * the edit-request modal to keep the field behavior identical everywhere.
 */
export function DocumentFieldsForm({ fields, values, onChange, document }: DocumentFieldsFormProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map((fieldKey) => {
        const config = FIELD_CONFIGS[fieldKey];
        if (!config) return null;
        const Icon = FIELD_ICONS[fieldKey];
        const currentValue = values[fieldKey] ?? "";
        const inputId = `doc-field-${fieldKey}`;
        const errorId = `${inputId}-error`;
        const error = documentFieldError(fieldKey, currentValue);
        const label = (
          <label htmlFor={inputId} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            {Icon && <Icon className="size-3.5 text-sky-500" />}
            {config.label}
            {isFieldRequired(fieldKey, config.required, document) && <span className="text-red-400">*</span>}
          </label>
        );
        const inputClass = "h-9 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 bg-white";

        if (config.type === "select") {
          return (
            <div key={fieldKey} className="space-y-1.5">
              {label}
              <Select
                value={String(currentValue)}
                onValueChange={(val) => onChange(fieldKey, val)}
              >
                <SelectTrigger id={inputId} className="w-full h-9 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20 bg-white">
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
              <FieldError id={errorId} message={error} />
            </div>
          );
        }

        if (fieldKey === "titleNo") {
          return (
            <div key={fieldKey} className="space-y-1.5">
              {label}
              <TitleNoInput
                id={inputId}
                value={currentValue}
                onChange={(val) => onChange(fieldKey, val)}
                invalid={!!error}
                className={inputClass}
              />
              <FieldError id={errorId} message={error} />
            </div>
          );
        }

        if (config.type === "number") {
          return (
            <div key={fieldKey} className="space-y-1.5">
              {label}
              <Input
                id={inputId}
                type="number"
                placeholder={config.placeholder}
                value={currentValue}
                onChange={(e) =>
                  onChange(fieldKey, e.target.value ? Number(e.target.value) : null)
                }
                aria-invalid={!!error || undefined}
                aria-describedby={error ? errorId : undefined}
                className={inputClass}
                min={0}
              />
              <FieldError id={errorId} message={error} />
            </div>
          );
        }

        return (
          <div key={fieldKey} className="space-y-1.5">
            {label}
            <Input
              id={inputId}
              type={config.type}
              placeholder={config.placeholder}
              value={String(currentValue)}
              onChange={(e) => onChange(fieldKey, e.target.value)}
              maxLength={FIELD_MAX_LENGTHS[fieldKey]}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? errorId : undefined}
              className={inputClass}
            />
            <FieldError id={errorId} message={error} />
          </div>
        );
      })}
    </div>
  );
}

/** True when every required field in `fields` has a non-empty value. */
export function isFieldsValid(
  fields: string[],
  values: Record<string, string | number | null>,
  document?: string | null,
): boolean {
  return fields.every((fk) => {
    const config = FIELD_CONFIGS[fk];
    const v = values[fk];
    const empty = v === null || v === undefined || String(v).trim() === "";
    if (empty) return !isFieldRequired(fk, config?.required, document);
    return PROFILE_FIELD_KEYS.includes(fk) || !documentFieldError(fk, v);
  });
}

export function hasFieldErrors(fields: string[], values: Record<string, string | number | null>): boolean {
  return fields.some((fk) => !!documentFieldError(fk, values[fk]));
}
