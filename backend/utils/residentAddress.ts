// Resident addresses are stored as the street / house-number portion only (the
// system serves a single barangay). This appends the fixed locality —
// "<barangay name>, <municipality>, <province>" — wherever an address is shown
// or printed, skipping values that already contain it and placeholders.
export interface BarangayLocality {
  name?: string | null;
  municipality?: string | null;
  province?: string | null;
}

const PLACEHOLDER_VALUES = new Set([
  "",
  "n/a",
  "na",
  "none",
  "null",
  "-",
  "undeclared",
  "not applicable",
  "unknown",
]);

export function barangayLocality(barangay?: BarangayLocality | null): string {
  const name = String(barangay?.name ?? "").trim() || "Barangay Rabon";
  const municipality = String(barangay?.municipality ?? "").trim() || "Rosario";
  const province = String(barangay?.province ?? "").trim() || "La Union";
  return [name, municipality, province].filter(Boolean).join(", ");
}

export function withBarangayLocality(
  address: unknown,
  barangay?: BarangayLocality | null,
): string {
  const raw = String(address ?? "").trim();
  if (PLACEHOLDER_VALUES.has(raw.toLowerCase())) return raw;

  const name = String(barangay?.name ?? "").trim() || "Barangay Rabon";
  const municipality = String(barangay?.municipality ?? "").trim() || "Rosario";
  const province = String(barangay?.province ?? "").trim() || "La Union";

  const lower = raw.toLowerCase();
  const alreadyLocalized =
    (name && lower.includes(name.toLowerCase())) ||
    (municipality && province && lower.includes(municipality.toLowerCase()) && lower.includes(province.toLowerCase()));
  if (alreadyLocalized) return raw;

  return [raw, name, municipality, province].filter(Boolean).join(", ");
}
