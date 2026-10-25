import mongoose from "mongoose";
import ProgramEnrollmentModel from "../model/programEnrollment.model";
import ResidentCensusModel from "../model/residentCensus.model";
import { ProgramKey } from "../utils/eligibility";
import {
  HouseholdMember,
  ProgramEligibilityResult,
} from "../types/programEligibility.type";

const AUTO_ACTOR = "System (automatic)";
const AUTO_NOTE = "Auto-selected from household income eligibility";

function toObjectIdOrUndefined(value?: string): mongoose.Types.ObjectId | undefined {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return undefined;
  return new mongoose.Types.ObjectId(value);
}

export interface EnrollmentInput {
  program: ProgramKey;
  censusId: string;
  accountId?: string;
  name: string;
  householdNumber: string;
  monthlySalary: number;
  householdTotalIncome: number;
  batchNumber?: number;
  note?: string;
}

export class ProgramEnrollmentService {
  /** Create or re-activate an enrollment for a (program, census) pair. */
  static async upsert(
    input: EnrollmentInput,
    actor: { name: string; id: string },
  ) {
    return await ProgramEnrollmentModel.findOneAndUpdate(
      { program: input.program, censusId: input.censusId },
      {
        $set: {
          accountId: input.accountId || undefined,
          name: input.name,
          householdNumber: input.householdNumber,
          monthlySalary: input.monthlySalary,
          householdTotalIncome: input.householdTotalIncome,
          batchNumber: input.batchNumber ?? 0,
          note: input.note ?? "",
          status: "enrolled",
          enrolledBy: actor.name,
          enrolledById: actor.id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  static async list(filter: Record<string, any> = {}) {
    return await ProgramEnrollmentModel.find(filter).sort({
      program: 1,
      batchNumber: 1,
      householdTotalIncome: 1,
      name: 1,
    });
  }

  static async get(id: string) {
    return await ProgramEnrollmentModel.findById(id);
  }

  static async setStatus(
    id: string,
    status: "enrolled" | "removed",
    actor: { name: string; id: string },
  ) {
    return await ProgramEnrollmentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          enrolledBy: actor.name,
          enrolledById: actor.id,
        },
      },
      { new: true },
    );
  }

  static async summary() {
    const rows = await ProgramEnrollmentModel.aggregate([
      { $match: { status: "enrolled" } },
      { $group: { _id: "$program", count: { $sum: 1 } } },
    ]);
    const summary: Record<string, number> = { "4Ps": 0, TUPAD: 0 };
    for (const row of rows) {
      summary[row._id] = row.count;
    }
    return summary;
  }

  /**
   * Persist the system-selected beneficiaries so the roster (and the census
   * 4Ps flag) stays in sync with the current eligibility rules.
   *
   * Selection is fully automatic: nobody picks beneficiaries. Every eligible
   * individual is enrolled, anyone who is no longer eligible is marked
   * removed, and the census `is4Ps` flag mirrors the 4Ps selection.
   */
  static async syncFromEligibility(
    result: ProgramEligibilityResult,
  ): Promise<{ enrolled: number; removed: number }> {
    const ops: any[] = [];
    const activeKeys = new Set<string>();
    const fourPsCensusIds: mongoose.Types.ObjectId[] = [];

    const add = (program: ProgramKey, member: HouseholdMember, batchNumber: number) => {
      const key = `${program}:${member.censusId}`;
      if (activeKeys.has(key)) return;
      activeKeys.add(key);

      const censusId = toObjectIdOrUndefined(member.censusId);
      if (!censusId) return;
      if (program === "4Ps") fourPsCensusIds.push(censusId);

      const setFields: Record<string, unknown> = {
        name: member.name,
        householdNumber: member.householdNumber,
        monthlySalary: member.monthlySalary,
        householdTotalIncome: member.householdTotalIncome,
        batchNumber,
        note: AUTO_NOTE,
        status: "enrolled",
        enrolledBy: AUTO_ACTOR,
        enrolledById: "",
      };
      const accountId = toObjectIdOrUndefined(member.accountId);
      if (accountId) setFields.accountId = accountId;

      ops.push({
        updateOne: {
          filter: { program, censusId },
          update: { $set: setFields },
          upsert: true,
        },
      });
    };

    for (const batch of result.fourPs.batches) {
      for (const member of batch.individuals) add("4Ps", member, batch.batchNumber);
    }
    for (const batch of result.tupad.batches) {
      for (const member of batch.individuals) add("TUPAD", member, batch.batchNumber);
    }

    if (ops.length > 0) {
      await ProgramEnrollmentModel.bulkWrite(ops, { ordered: false });
    }

    // Anyone previously enrolled who is no longer eligible is marked removed.
    const existing = await ProgramEnrollmentModel.find({ status: "enrolled" }).select(
      "_id program censusId",
    );
    const removeOps: any[] = existing
      .filter((row) => !activeKeys.has(`${row.program}:${String(row.censusId)}`))
      .map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { status: "removed" as const } },
        },
      }));
    if (removeOps.length > 0) {
      await ProgramEnrollmentModel.bulkWrite(removeOps, { ordered: false });
    }

    // Mirror the automatic 4Ps selection onto the census flag.
    await ResidentCensusModel.updateMany(
      { is4Ps: "YES", _id: { $nin: fourPsCensusIds } },
      { $set: { is4Ps: "NO" } },
    );
    if (fourPsCensusIds.length > 0) {
      await ResidentCensusModel.updateMany(
        { _id: { $in: fourPsCensusIds }, is4Ps: { $ne: "YES" } },
        { $set: { is4Ps: "YES" } },
      );
    }

    return { enrolled: ops.length, removed: removeOps.length };
  }
}
