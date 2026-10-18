import ProgramEnrollmentModel from "../model/programEnrollment.model";
import { ProgramKey } from "../utils/eligibility";

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
}
