import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import ResidentCensusModel from "../model/residentCensus.model";
import { ProgramEligibilityService } from "../services/programEligibility.service";
import { ProgramEnrollmentService } from "../services/programEnrollment.service";
import { AuditLogService } from "../services/auditLog.service";
import { isObjectId, isIn, withinLength, MAX_SHORT_TEXT_LENGTH } from "../utils/validation";
import { PROGRAM_KEYS, ProgramKey } from "../utils/eligibility";
import { normalizeHouseholdNumber } from "../utils/residentDataStandardization";

const isProgram = isIn(PROGRAM_KEYS);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function actorOf(request: AuthRequest) {
  return {
    name: request.account?.name ?? "System",
    id: request.account?._id?.toString?.() ?? "",
  };
}

function salaryOf(record: any): number {
  const value = Number(record?.monthlySalary);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export class ProgramEligibilityController {
  /** GET /program-eligibility — current low-income eligibility picture. */
  static eligibility = async (_request: AuthRequest, response: Response) => {
    try {
      const result = await ProgramEligibilityService.compute();
      response.send(result);
    } catch (error) {
      console.error("[PROGRAM ELIGIBILITY ERROR]", error);
      response.status(500).send("Failed to compute program eligibility");
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

  /** POST /program-eligibility/enrollments — mark a resident as a beneficiary. */
  static enroll = async (request: AuthRequest, response: Response) => {
    try {
      const { program, censusId, note } = request.body ?? {};
      if (!isProgram(program)) {
        response.status(400).json({ message: "program must be one of: 4Ps, TUPAD" });
        return;
      }
      if (!isObjectId(censusId)) {
        response.status(400).json({ message: "A valid censusId is required" });
        return;
      }
      if (note !== undefined && !withinLength(String(note), MAX_SHORT_TEXT_LENGTH)) {
        response.status(400).json({ message: "note is too long" });
        return;
      }

      const census = await ResidentCensusModel.findById(censusId);
      if (!census || census.isArchived) {
        response.status(404).json({ message: "Resident census record not found" });
        return;
      }

      // Household income is recomputed from the live census so the stored
      // enrollment snapshot reflects the household as it stands now.
      const householdNumber = normalizeHouseholdNumber(census.householdNumber);
      let householdTotalIncome = salaryOf(census);
      if (householdNumber !== "N/A") {
        const members = await ResidentCensusModel.find({
          householdNumber: new RegExp(`^${escapeRegExp(householdNumber)}$`, "i"),
          isArchived: { $ne: true },
        });
        householdTotalIncome = members.reduce((sum, m) => sum + salaryOf(m), 0);
      }

      // Resolve the 4Ps batch the person currently falls into, if any.
      let batchNumber = 0;
      if (program === "4Ps") {
        const result = await ProgramEligibilityService.compute();
        const batch = result.fourPs.batches.find((b) =>
          b.individuals.some((i) => i.censusId === String(census._id)),
        );
        batchNumber = batch?.batchNumber ?? 0;
      }

      const actor = actorOf(request);
      const enrollment = await ProgramEnrollmentService.upsert(
        {
          program: program as ProgramKey,
          censusId: String(census._id),
          accountId: census.accountId ? String(census.accountId) : undefined,
          name: census.name ?? "N/A",
          householdNumber,
          monthlySalary: salaryOf(census),
          householdTotalIncome,
          batchNumber,
          note: note !== undefined ? String(note) : "",
        },
        actor,
      );

      // Keep the census 4Ps flag in sync with the persisted enrollment.
      if (program === "4Ps") {
        await ResidentCensusModel.updateOne(
          { _id: census._id },
          { $set: { is4Ps: "YES" } },
        ).catch(() => {});
      }

      await AuditLogService.create({
        actor: actor.name,
        actorId: actor.id,
        action: "create",
        entity: "programEnrollment",
        entityId: enrollment._id.toString(),
        entityLabel: `${program} beneficiary: ${enrollment.name}`,
        newValue: { program, householdTotalIncome, batchNumber },
      }).catch(() => null);

      response.status(201).send(enrollment);
    } catch (error) {
      console.error("[PROGRAM ENROLL ERROR]", error);
      response.status(500).send("Failed to mark program beneficiary");
    }
  };

  /** DELETE /program-eligibility/enrollments/:id — remove a beneficiary. */
  static removeEnrollment = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid enrollment id");
        return;
      }
      const existing = await ProgramEnrollmentService.get(id);
      if (!existing) {
        response.status(404).send("Enrollment not found");
        return;
      }

      const actor = actorOf(request);
      const enrollment = await ProgramEnrollmentService.setStatus(id, "removed", actor);

      // Revert the census 4Ps flag when a 4Ps enrollment is removed.
      if (existing.program === "4Ps" && existing.censusId) {
        await ResidentCensusModel.updateOne(
          { _id: existing.censusId, is4Ps: "YES" },
          { $set: { is4Ps: "NO" } },
        ).catch(() => {});
      }

      await AuditLogService.create({
        actor: actor.name,
        actorId: actor.id,
        action: "update",
        entity: "programEnrollment",
        entityId: id,
        entityLabel: `${existing.program} beneficiary removed: ${existing.name}`,
        newValue: { status: "removed" },
      }).catch(() => null);

      response.send(enrollment);
    } catch (error) {
      console.error("[PROGRAM ENROLL REMOVE ERROR]", error);
      response.status(500).send("Failed to remove program beneficiary");
    }
  };
}
