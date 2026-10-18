import ResidentCensusModel from "../model/residentCensus.model";
import {
  FOURPS_BATCH_SIZE,
  LOW_INCOME_HOUSEHOLD_THRESHOLD,
  chunk,
  isLowIncomeHousehold,
} from "../utils/eligibility";
import {
  FourPsBatch,
  HouseholdMember,
  HouseIncomeGroup,
  ProgramEligibilityResult,
} from "../types/programEligibility.type";
import {
  isUnknown,
  normalizeHouseholdNumber,
} from "../utils/residentDataStandardization";

function salaryOf(record: any): number {
  const value = Number(record?.monthlySalary);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Household-based low-income eligibility for the 4Ps and TUPAD programs.
 *
 * Rule set (single source of truth lives in utils/eligibility):
 *  - A household's income is the sum of every active member's monthlySalary,
 *    grouped by householdNumber.
 *  - A household is low-income when its total is BELOW ₱30,000/month.
 *  - 4Ps recommends every individual in a low-income household, ordered by
 *    lowest household income first, packaged into batches of 50.
 *  - TUPAD recommends the same individuals with no batching.
 */
export class ProgramEligibilityService {
  static async compute(): Promise<ProgramEligibilityResult> {
    const residents = await ResidentCensusModel.find({
      isArchived: { $ne: true },
    });

    const groups = new Map<string, any[]>();
    let unassignedResidents = 0;

    for (const r of residents) {
      const key = normalizeHouseholdNumber(r.householdNumber);
      if (key === "N/A") {
        unassignedResidents++;
        continue;
      }
      const bucket = groups.get(key);
      if (bucket) bucket.push(r);
      else groups.set(key, [r]);
    }

    const households: HouseIncomeGroup[] = [];
    for (const [householdNumber, members] of groups) {
      const totalMonthlySalary = members.reduce(
        (sum, m) => sum + salaryOf(m),
        0,
      );
      const lowIncome = isLowIncomeHousehold(totalMonthlySalary);
      const purok =
        members.find((m) => !isUnknown(m.purok))?.purok ?? "N/A";

      const mappedMembers: HouseholdMember[] = members
        .map((m) => ({
          censusId: String(m._id),
          accountId: m.accountId ? String(m.accountId) : "",
          name: m.name ?? "N/A",
          age: m.age ?? "N/A",
          sex: m.sex ?? "N/A",
          purok: m.purok ?? "N/A",
          occupation: m.occupation ?? "N/A",
          monthlySalary: salaryOf(m),
          is4Ps: m.is4Ps ?? "N/A",
          householdNumber,
          householdTotalIncome: totalMonthlySalary,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      households.push({
        householdNumber,
        purok,
        memberCount: members.length,
        totalMonthlySalary,
        lowIncome,
        members: mappedMembers,
      });
    }

    // Lowest household income first; tie-break by household number for a stable
    // order so generated batches are reproducible.
    households.sort(
      (a, b) =>
        a.totalMonthlySalary - b.totalMonthlySalary ||
        a.householdNumber.localeCompare(b.householdNumber),
    );

    const lowIncomeHouseholds = households.filter((h) => h.lowIncome);

    // Flatten eligible individuals while keeping households intact and ordered
    // by household income (the low-income households are already sorted).
    const eligibleIndividuals: HouseholdMember[] = lowIncomeHouseholds.flatMap(
      (h) => h.members,
    );

    const batches: FourPsBatch[] = chunk(
      eligibleIndividuals,
      FOURPS_BATCH_SIZE,
    ).map((individuals, index) => ({
      batchNumber: index + 1,
      count: individuals.length,
      minHouseholdIncome: individuals.reduce(
        (min, i) => Math.min(min, i.householdTotalIncome),
        Number.POSITIVE_INFINITY,
      ),
      maxHouseholdIncome: individuals.reduce(
        (max, i) => Math.max(max, i.householdTotalIncome),
        Number.NEGATIVE_INFINITY,
      ),
      individuals,
    }));

    return {
      threshold: LOW_INCOME_HOUSEHOLD_THRESHOLD,
      batchSize: FOURPS_BATCH_SIZE,
      generatedAt: new Date().toISOString(),
      totals: {
        totalHouseholds: households.length,
        lowIncomeHouseholds: lowIncomeHouseholds.length,
        totalResidents: residents.length,
        lowIncomeIndividuals: eligibleIndividuals.length,
        unassignedResidents,
      },
      households,
      fourPs: {
        program: "4Ps",
        eligibleIndividuals: eligibleIndividuals.length,
        eligibleHouseholds: lowIncomeHouseholds.length,
        batchCount: batches.length,
        batches,
      },
      tupad: {
        program: "TUPAD",
        eligibleIndividuals: eligibleIndividuals.length,
        eligibleHouseholds: lowIncomeHouseholds.length,
        individuals: eligibleIndividuals,
      },
    };
  }
}
