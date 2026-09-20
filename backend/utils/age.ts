// Computes full calendar years between a birth date (YYYY-MM-DD) and today.
// Returns "N/A" when no parseable date is given, matching the residence
// census convention where unknown/unset values are stored as "N/A".
export function calculateAge(dob: string | undefined | null): string {
  if (!dob) return "N/A";
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return "N/A";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return String(age);
}