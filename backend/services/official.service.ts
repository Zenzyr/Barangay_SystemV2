import OfficialModel from "../model/official.model";
import {
  officialInterfaceInput,
  officialInterface,
  SINGLE_HOLDER_POSITIONS,
} from "../types/official.type";
import { isNonEmptyString } from "../utils/validation";

export class OfficialService {
  static async create(data: officialInterfaceInput) {
    return await OfficialModel.create(data);
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await OfficialModel.find(filter).sort({ status: 1, precedence: 1, fullName: 1 });
  }

  static async get(id: string) {
    return await OfficialModel.findById(id);
  }

  static async update(id: string, data: Partial<officialInterface>) {
    return await OfficialModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async delete(id: string) {
    return await OfficialModel.findByIdAndDelete(id);
  }

  static async getActiveByPosition(position: string) {
    return await OfficialModel.findOne({ position, status: "active" });
  }

  static async getActiveOfficials() {
    return await OfficialModel.find({ status: "active" }).sort({
      position: 1,
      precedence: 1,
      fullName: 1,
    });
  }

  /**
   * Validates a single official payload independent of persistence.
   * Returns a human-readable error message or null when valid.
   */
  static validate(data: Partial<officialInterfaceInput>): string | null {
    if (!isNonEmptyString(data.fullName)) {
      return "Full name is required";
    }
    if (!isNonEmptyString(data.position)) {
      return "Position is required";
    }
    if (!isNonEmptyString(data.status) || (data.status !== "active" && data.status !== "inactive")) {
      return "Status must be active or inactive";
    }
    const start = data.termStart ?? "";
    const end = data.termEnd ?? "";
    if (start && end && new Date(start) > new Date(end)) {
      return "Term end date cannot be earlier than the term start date";
    }
    return null;
  }

  /**
   * Creates a new official. When the new record is ACTIVE and belongs to a
   * single-holder position, the previous active holder is moved to the
   * historical/inactive set automatically. Returns the created document plus a
   * flag describing whether a replacement happened and the deactivated record.
   */
  static async createWithReplacement(
    data: officialInterfaceInput,
    actor?: { name: string; id: string }
  ): Promise<{ official: any; replaced?: any }> {
    const error = OfficialService.validate(data);
    if (error) throw new Error(error);

    let replaced: any = null;

    if (
      data.status === "active" &&
      SINGLE_HOLDER_POSITIONS.includes(data.position as any)
    ) {
      const previous = await OfficialService.getActiveByPosition(data.position);
      if (previous) {
        await OfficialModel.findByIdAndUpdate(previous._id, { status: "inactive" });
        replaced = previous;
      }
    }

    const official = await OfficialService.create(data);
    return { official, replaced };
  }

  /**
   * Updates an existing official. If the update sets an ACTIVE single-holder
   * official whose position currently has a *different* active holder, that
   * holder is deactivated first.
   */
  static async updateWithReplacement(
    id: string,
    data: Partial<officialInterfaceInput>,
    actor?: { name: string; id: string }
  ): Promise<{ official: any; replaced?: any }> {
    const { ...rest } = data;
    const existing = await OfficialService.get(id);
    const merged = { ...(existing?.toObject?.() ?? {}), ...rest } as Partial<officialInterfaceInput>;
    const error = OfficialService.validate(merged);
    if (error) throw new Error(error);
    if (!existing) throw new Error("Official not found");
    const current: any = existing;

    let replaced: any = null;
    const targetStatus = data.status !== undefined ? data.status : current.status;
    const targetPosition = data.position !== undefined ? data.position : current.position;

    if (
      targetStatus === "active" &&
      SINGLE_HOLDER_POSITIONS.includes(targetPosition as any)
    ) {
      const existing = await OfficialService.getActiveByPosition(targetPosition);
      if (existing && existing._id.toString() !== id) {
        await OfficialModel.findByIdAndUpdate(existing._id, { status: "inactive" });
        replaced = existing;
      }
    }

    const official = await OfficialModel.findByIdAndUpdate(id, data, { new: true });
    return { official, replaced };
  }
}