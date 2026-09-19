// Single source of truth for the {{variables}} a Tiptap document template may
// use. The frontend fetches this list from GET /document-templates-docx/variables
// — it is never duplicated client-side.
//
// Every variable maps to data BIMS actually has. `source` is a dotted path into
// the object returned by DocumentTemplateService.buildFieldContext() (the same
// context the PDF template builder resolves), so a later "generate document"
// step can reuse that context via resolveVariableValues(). Variables with no
// data source anywhere in BIMS (e.g. a resident/ID number) are deliberately
// NOT offered.

export type VariableGroup =
  | "Resident"
  | "Barangay"
  | "Officials"
  | "Document"
  | "Document-specific";

export interface TemplateVariable {
  key: string;
  label: string;
  group: VariableGroup;
  /** Dotted path into buildFieldContext()'s output. */
  source?: string;
  /** Value computed from context instead of read directly. */
  derive?: "age" | "issueDayOrdinal" | "issueMonth" | "issueYear" | `kagawad:${number}`;
  /** Short note shown in the UI when the source has caveats. */
  note?: string;
}

const kagawad = (n: number): TemplateVariable => ({
  key: `kagawad_${n}`,
  label: `Barangay Kagawad ${n}`,
  group: "Officials",
  derive: `kagawad:${n}`,
  note: "Active Barangay Kagawad, in order of precedence",
});

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // ── Resident ────────────────────────────────────────────────────────
  { key: "resident_name", label: "Resident Name", group: "Resident", source: "resident.fullName" },
  { key: "address", label: "Address", group: "Resident", source: "resident.address" },
  { key: "purok", label: "Purok", group: "Resident", source: "resident.purok" },
  { key: "birth_date", label: "Birth Date", group: "Resident", source: "resident.birthDate" },
  { key: "age", label: "Age", group: "Resident", derive: "age", note: "Computed from birth date, or the age entered on the request" },
  { key: "civil_status", label: "Civil Status", group: "Resident", source: "resident.civilStatus" },
  { key: "gender", label: "Gender", group: "Resident", source: "resident.gender", note: "Only available for residents with an account" },
  { key: "contact_number", label: "Contact Number", group: "Resident", source: "resident.contactNumber" },
  { key: "spouse_name", label: "Spouse Name", group: "Resident", source: "resident.spouseName" },

  // ── Barangay ────────────────────────────────────────────────────────
  { key: "barangay", label: "Barangay Name", group: "Barangay", source: "barangay.name" },
  { key: "municipality", label: "Municipality", group: "Barangay", source: "barangay.municipality" },
  { key: "province", label: "Province", group: "Barangay", source: "barangay.province" },
  { key: "region", label: "Region", group: "Barangay", source: "barangay.region" },
  { key: "barangay_address", label: "Barangay Address", group: "Barangay", source: "barangay.address" },

  // ── Officials (live from the Officials collection) ──────────────────
  { key: "punong_barangay", label: "Punong Barangay", group: "Officials", source: "barangay.punongBarangay" },
  { key: "barangay_secretary", label: "Barangay Secretary", group: "Officials", source: "barangay.secretary" },
  { key: "barangay_treasurer", label: "Barangay Treasurer", group: "Officials", source: "official.Barangay Treasurer" },
  { key: "sk_chairperson", label: "SK Chairperson", group: "Officials", source: "official.SK Chairperson" },
  kagawad(1), kagawad(2), kagawad(3), kagawad(4), kagawad(5), kagawad(6), kagawad(7),

  // ── Document ────────────────────────────────────────────────────────
  { key: "document_number", label: "Document Number", group: "Document", source: "certificate.number", note: "Entered manually on the request" },
  { key: "issue_date", label: "Issue Date (full)", group: "Document", source: "certificate.date" },
  { key: "issue_day_ordinal", label: "Issue Day (e.g. 7TH)", group: "Document", derive: "issueDayOrdinal" },
  { key: "issue_month", label: "Issue Month", group: "Document", derive: "issueMonth" },
  { key: "issue_year", label: "Issue Year", group: "Document", derive: "issueYear" },
  { key: "purpose", label: "Purpose", group: "Document", source: "resident.purpose" },

  // ── Document-specific (fields the requests already collect) ─────────
  { key: "work_status", label: "Work Status", group: "Document-specific", source: "resident.workStatus" },
  { key: "workplace", label: "Workplace", group: "Document-specific", source: "resident.workplace" },
  { key: "monthly_income", label: "Monthly Income", group: "Document-specific", source: "resident.monthlyIncome" },
  { key: "annual_income", label: "Annual Income", group: "Document-specific", source: "resident.annualIncome" },
  { key: "household_expenses", label: "Household Expenses", group: "Document-specific", source: "resident.householdExpenses" },
  { key: "expense_type", label: "Type of Unforeseen Expense", group: "Document-specific", source: "resident.expenseType" },
  { key: "title_no", label: "Title No.", group: "Document-specific", source: "resident.titleNo" },
  { key: "tax_declaration_no", label: "Tax Declaration No.", group: "Document-specific", source: "resident.taxDeclarationNo" },
  { key: "land_area", label: "Land Area (sqm)", group: "Document-specific", source: "resident.landArea" },
  { key: "tree_count", label: "Number of Trees", group: "Document-specific", source: "resident.treeCount" },
  { key: "tree_type", label: "Tree Type", group: "Document-specific", source: "resident.treeType" },
  { key: "assistance_to", label: "Assistance To (beneficiary)", group: "Document-specific", source: "resident.assistanceTo" },
];

export const TEMPLATE_VARIABLE_KEYS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

export const VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

// ── Resolution (used when a document is generated from real BIMS data) ──

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ordinalSuffix = (day: number): string => {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] || "th";
};

const getDot = (obj: any, path: string): any => {
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
};

const parseDate = (raw: unknown): Date | null => {
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
};

export function computeAge(birthDate: unknown, today: Date = new Date()): number | null {
  const birth = parseDate(birthDate);
  if (!birth) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * Builds { variableKey: value } from a buildFieldContext() result. Only keys
 * that resolve to a non-empty value are included, so applyVariables() leaves
 * unresolved variables visible instead of silently blanking them.
 */
export function resolveVariableValues(
  context: Record<string, any>,
  options: { kagawadNames?: string[]; today?: Date } = {}
): Record<string, string> {
  const values: Record<string, string> = {};
  const today = options.today ?? new Date();
  const issued = parseDate(getDot(context, "certificate.date")) ?? today;

  for (const variable of TEMPLATE_VARIABLES) {
    let value: unknown;
    if (variable.source) {
      value = getDot(context, variable.source);
      if (variable.key === "document_number" && /^_+$/.test(String(value ?? ""))) value = undefined;
    } else if (variable.derive === "age") {
      const fromRequest = getDot(context, "resident.age");
      value =
        fromRequest !== undefined && fromRequest !== ""
          ? fromRequest
          : computeAge(getDot(context, "resident.birthDate"), today) ?? undefined;
    } else if (variable.derive === "issueDayOrdinal") {
      value = `${issued.getDate()}${ordinalSuffix(issued.getDate()).toUpperCase()}`;
    } else if (variable.derive === "issueMonth") {
      value = MONTHS[issued.getMonth()];
    } else if (variable.derive === "issueYear") {
      value = String(issued.getFullYear());
    } else if (variable.derive?.startsWith("kagawad:")) {
      const index = Number(variable.derive.split(":")[1]) - 1;
      value = options.kagawadNames?.[index];
    }
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      values[variable.key] = String(value);
    }
  }
  return values;
}
