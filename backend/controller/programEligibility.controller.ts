import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ProgramEligibilityService } from "../services/programEligibility.service";
import { ProgramEnrollmentService } from "../services/programEnrollment.service";
import { isIn } from "../utils/validation";
import { PROGRAM_KEYS } from "../utils/eligibility";
import {
  HouseholdMember,
  ProgramBeneficiariesResult,
  ProgramEligibilityResult,
  PublicBeneficiary,
} from "../types/programEligibility.type";

const isProgram = isIn(PROGRAM_KEYS);

function toPublicBeneficiary(member: HouseholdMember): PublicBeneficiary {
  return {
    censusId: member.censusId,
    name: member.name,
    purok: member.purok,
    householdNumber: member.householdNumber,
    householdTotalIncome: member.householdTotalIncome,
  };
}

function toPublicResult(
  result: ProgramEligibilityResult,
): ProgramBeneficiariesResult {
  return {
    generatedAt: result.generatedAt,
    threshold: result.threshold,
    batchSize: result.batchSize,
    fourPs: {
      eligibleIndividuals: result.fourPs.eligibleIndividuals,
      batchCount: result.fourPs.batchCount,
      batches: result.fourPs.batches.map((batch) => ({
        batchNumber: batch.batchNumber,
        count: batch.count,
        individuals: batch.individuals.map(toPublicBeneficiary),
      })),
    },
    tupad: {
      eligibleIndividuals: result.tupad.eligibleIndividuals,
      batchSize: result.tupad.batchSize,
      batchCount: result.tupad.batchCount,
      batches: result.tupad.batches.map((batch) => ({
        batchNumber: batch.batchNumber,
        count: batch.count,
        individuals: batch.individuals.map(toPublicBeneficiary),
      })),
      individuals: result.tupad.individuals.map(toPublicBeneficiary),
    },
  };
}

export class ProgramEligibilityController {
  /** GET /program-eligibility — current low-income eligibility picture. */
  static eligibility = async (_request: AuthRequest, response: Response) => {
    try {
      const result = await ProgramEligibilityService.computeAndSync();
      response.send(result);
    } catch (error) {
      console.error("[PROGRAM ELIGIBILITY ERROR]", error);
      response.status(500).send("Failed to compute program eligibility");
    }
  };

  /**
   * GET /program-eligibility/beneficiaries — the automatically selected
   * beneficiaries, sanitized for resident transparency. No salaries or
   * account identifiers are exposed.
   */
  static beneficiaries = async (_request: AuthRequest, response: Response) => {
    try {
      const result = await ProgramEligibilityService.computeAndSync();
      response.send(toPublicResult(result));
    } catch (error) {
      console.error("[PROGRAM BENEFICIARIES ERROR]", error);
      response.status(500).send("Failed to compute program beneficiaries");
    }
  };

  /** GET /program-eligibility/enrollments?program=&status= */
  static listEnrollments = async (request: AuthRequest, response: Response) => {
    try {
      const { program, status } = request.query;
      const filter: Record<string, any> = {};
      if (isProgram(program)) filter.program = program;
      if (isIn(["enrolled", "removed"] as const)(status)) filter.status = status;
      const rows = await ProgramEnrollmentService.list(filter);
      response.send(rows);
    } catch (error) {
      console.error("[PROGRAM ENROLLMENT LIST ERROR]", error);
      response.status(500).send("Failed to fetch program enrollments");
    }
  };

  /** GET /program-eligibility/enrollments/summary */
  static enrollmentSummary = async (_request: AuthRequest, response: Response) => {
    try {
      response.send(await ProgramEnrollmentService.summary());
    } catch (error) {
      console.error("[PROGRAM ENROLLMENT SUMMARY ERROR]", error);
      response.status(500).send("Failed to compute program enrollment summary");
    }
  };
}
