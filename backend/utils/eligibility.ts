// Centralized rules for the low-income benefit eligibility used by Decision
// Support. This is the ONLY place the household income ceiling and the 4Ps
// batch size are defined, so the analytics indicator, the recommendation seed
// and the API responses can never drift apart.

// A household whose combined monthly salary is BELOW this amount is treated as
// low-income and becomes eligible for the 4Ps and TUPAD programs.
export const LOW_INCOME_HOUSEHOLD_THRESHOLD = 30_000;

// The 4Ps program enrolls eligible individuals in batches of this size,
// lowest-household-income first.
export const FOURPS_BATCH_SIZE = 50;

// Programs that draw on the low-income eligibility pool.
export type ProgramKey = "4Ps" | "TUPAD";

export const PROGRAM_KEYS: readonly ProgramKey[] = ["4Ps", "TUPAD"];

export function isLowIncomeHousehold(totalMonthlySalary: number): boolean {
  const total = Number.isFinite(totalMonthlySalary) ? totalMonthlySalary : 0;
  return total < LOW_INCOME_HOUSEHOLD_THRESHOLD;
}

/** Splits an ordered list into fixed-size chunks (last chunk may be shorter). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
