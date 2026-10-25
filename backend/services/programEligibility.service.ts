import ResidentCensusModel from "../model/residentCensus.model";
import {
  FOURPS_BATCH_SIZE,
  LOW_INCOME_HOUSEHOLD_THRESHOLD,
  TUPAD_BATCH_SIZE,
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
import { ProgramEnrollmentService } from "./programEnrollment.service";

function salaryOf(record: any): number {
  const value = Number(record?.monthlySalary);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Splits an already-ordered, de-duplicated list of individuals into numbered
 * batches. Each individual appears in exactly one batch.
 */
function buildBatches(
  individuals: HouseholdMember[],
  size: number,
): FourPsBatch[] {
  return chunk(individuals, size).map((members, index) => ({
    batchNumber: index + 1,
    count: members.length,
    minHouseholdIncome: members.reduce(
      (min, i) => Math.min(min, i.householdTotalIncome),
      Number.POSITIVE_INFINITY,
    ),
    maxHouseholdIncome: members.reduce(
      (max, i) => Math.max(max, i.householdTotalIncome),
      Number.NEGATIVE_INFINITY,
    ),
    individuals: members,
  }));
}

/**
 * Household-based low-income eligibility for the 4Ps and TUPAD programs.
 *
 * Rule set (single source of truth lives in utils/eligibility):
 *  - A household's income is the sum of every active member's monthlySalary,
 *    grouped by householdNumber.
 *  - A household is low-income when its total is BELOW ₱30,000/month.
 *  - 4Ps selects ONE representative per low-income household (the member with
 *    the lowest monthly salary, ties broken by name), ordered by lowest
 *    household income first and packaged into batches of 50.
 *  - TUPAD selects the remaining members of those households, in batches of 30.
 *  - A resident is therefore never listed in both programs.
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

    // 4Ps takes exactly one representative per low-income household. TUPAD
    // gets the remaining members, so nobody appears in both programs.
    const fourPsIndividuals: HouseholdMember[] = [];
    const tupadIndividuals: HouseholdMember[] = [];
    const tupadHouseholds = new Set<string>();

    for (const household of lowIncomeHouseholds) {
      // Lowest earner represents the household; ties are broken by name so the
      // selection is deterministic.
      const ordered = [...household.members].sort(
        (a, b) =>
          a.monthlySalary - b.monthlySalary ||
          a.name.localeCompare(b.name) ||
          a.censusId.localeCompare(b.censusId),
      );
      const [representative, ...remaining] = ordered;
      if (!representative) continue;

      fourPsIndividuals.push(representative);
      if (remaining.length > 0) {
        tupadIndividuals.push(...remaining);
        tupadHouseholds.add(household.householdNumber);
      }
    }

    const batches: FourPsBatch[] = buildBatches(
      fourPsIndividuals,
      FOURPS_BATCH_SIZE,
    );
    const tupadBatches: FourPsBatch[] = buildBatches(
      tupadIndividuals,
      TUPAD_BATCH_SIZE,
    );

    return {
      threshold: LOW_INCOME_HOUSEHOLD_THRESHOLD,
      batchSize: FOURPS_BATCH_SIZE,
      generatedAt: new Date().toISOString(),
      totals: {
        totalHouseholds: households.length,
        lowIncomeHouseholds: lowIncomeHouseholds.length,
        totalResidents: residents.length,
        lowIncomeIndividuals: fourPsIndividuals.length + tupadIndividuals.length,
        unassignedResidents,
      },
      households,
      fourPs: {
        program: "4Ps",
        eligibleIndividuals: fourPsIndividuals.length,
        eligibleHouseholds: lowIncomeHouseholds.length,
        batchCount: batches.length,
        batches,
      },
      tupad: {
        program: "TUPAD",
        eligibleIndividuals: tupadIndividuals.length,
        eligibleHouseholds: tupadHouseholds.size,
        batchSize: TUPAD_BATCH_SIZE,
        batchCount: tupadBatches.length,
        batches: tupadBatches,
        individuals: tupadIndividuals,
      },
    };
  }

  /**
   * Compute eligibility and let the system persist the selection. This is the
   * entry point used by both the staff panel and the resident transparency
   * view, so the roster always reflects the same automatic decision.
   */
  static async computeAndSync(): Promise<ProgramEligibilityResult> {
    const result = await this.compute();
    await ProgramEnrollmentService.syncFromEligibility(result);
    return result;
  }
}
