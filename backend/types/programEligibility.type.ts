export interface HouseholdMember {
  censusId: string;
  accountId: string;
  name: string;
  age: number | string;
  sex: string;
  purok: string;
  occupation: string;
  monthlySalary: number;
  is4Ps: string;
  householdNumber: string;
  householdTotalIncome: number;
}

export interface HouseIncomeGroup {
  householdNumber: string;
  purok: string;
  memberCount: number;
  totalMonthlySalary: number;
  lowIncome: boolean;
  members: HouseholdMember[];
}

export interface FourPsBatch {
  batchNumber: number;
  count: number;
  minHouseholdIncome: number;
  maxHouseholdIncome: number;
  individuals: HouseholdMember[];
}

export interface ProgramEligibilityResult {
  threshold: number;
  batchSize: number;
  generatedAt: string;
  totals: {
    totalHouseholds: number;
    lowIncomeHouseholds: number;
    totalResidents: number;
    lowIncomeIndividuals: number;
    // Active residents whose household number is "N/A"/blank, so their
    // household income cannot be aggregated. They are excluded from the
    // low-income pool until they are assigned to a household.
    unassignedResidents: number;
  };
  // Low-income households only, sorted lowest household income first.
  households: HouseIncomeGroup[];
  fourPs: {
    program: "4Ps";
    eligibleIndividuals: number;
    eligibleHouseholds: number;
    batchCount: number;
    batches: FourPsBatch[];
  };
  tupad: {
    program: "TUPAD";
    eligibleIndividuals: number;
    eligibleHouseholds: number;
    batchSize: number;
    batchCount: number;
    batches: FourPsBatch[];
    individuals: HouseholdMember[];
  };
}

/** Sanitized beneficiary row exposed to residents for transparency. */
export interface PublicBeneficiary {
  censusId: string;
  name: string;
  purok: string;
  householdNumber: string;
  householdTotalIncome: number;
}

export interface PublicFourPsBatch {
  batchNumber: number;
  count: number;
  individuals: PublicBeneficiary[];
}

/**
 * Resident-facing view of the automatically selected beneficiaries. Contains
 * only the fields needed to understand who was selected — never salaries,
 * account ids, or non-eligible households.
 */
export interface ProgramBeneficiariesResult {
  generatedAt: string;
  threshold: number;
  batchSize: number;
  fourPs: {
    eligibleIndividuals: number;
    batchCount: number;
    batches: PublicFourPsBatch[];
  };
  tupad: {
    eligibleIndividuals: number;
    batchSize: number;
    batchCount: number;
    batches: PublicFourPsBatch[];
    individuals: PublicBeneficiary[];
  };
}
