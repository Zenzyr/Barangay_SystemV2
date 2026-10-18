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
    unassignedResidents: number;
  };
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
    individuals: HouseholdMember[];
  };
}

export interface ProgramEnrollment {
  _id: string;
  program: "4Ps" | "TUPAD";
  censusId: string;
  accountId?: string;
  name: string;
  householdNumber: string;
  monthlySalary: number;
  householdTotalIncome: number;
  batchNumber: number;
  status: "enrolled" | "removed";
  note: string;
  enrolledBy: string;
  createdAt: string;
  updatedAt: string;
}
