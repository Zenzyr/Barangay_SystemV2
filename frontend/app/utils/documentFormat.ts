/**
 * Shared document value formatters used by both the generic PDF generator
 * and the template renderer. Content mirrors the official barangay
 * templates found in `document/`.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

export function formatDateFull(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateParts(dateStr: string): { day: string; month: string; year: string } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  const year = String(d.getFullYear());
  return { day: `${day}${ordinalSuffix(day)}`, month, year };
}

/** "15th day of August, 2026" — the phrasing used on the official templates. */
export function formatDatePhrase(dateStr: string): string {
  const parts = formatDateParts(dateStr);
  if (!parts) return dateStr || "";
  return `${parts.day} day of ${parts.month}, ${parts.year}`;
}

/** "2004-05-03" — the phrasing used for the date-of-birth field on the clearance. */
export function formatDateISO(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "09.06.2026" — the `mm.dd.yyyy` phrasing used on the document footer. */
export function formatDateMDY(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}.${d.getFullYear()}`;
}

export function formatFieldValue(key: string, value: unknown, format?: string): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value);

  // Explicit format overrides win over the key-based date shortcuts.
  if (format === "date-iso") {
    return formatDateISO(str);
  }
  if (format === "date-phrase") {
    return formatDatePhrase(str);
  }
  if (format === "date" || key === "dateIssued" || key === "dateOfBirth") {
    return formatDateFull(str);
  }
  if (format === "currency") {
    // WinAnsi standard PDF fonts can't encode the peso sign (₱), and the
    // barangay templates write "Php <amount>" anyway.
    const amount = Number(str).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `Php ${amount}`;
  }
  if (format === "number") {
    return Number(str).toLocaleString("en-PH");
  }
  return str;
}