import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ResidentCensusService } from "../services/residentCensus.service";
import { residentCensusInterfaceInput } from "../types/residentCensus.type";
import { isObjectId, isName, isNonEmptyString } from "../utils/validation";
import { matchPerson } from "../utils/duplicateCheck";

export class ResidentCensusController {

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const data: residentCensusInterfaceInput = request.body;

      if (!isName(data.name)) {
        response.status(400).send("A valid resident name is required");
        return;
      }
      if (!isNonEmptyString(data.purok)) {
        response.status(400).send("Purok is required");
        return;
      }
      const ageOk =
        data.age === "N/A" ||
        (typeof data.age === "number" && data.age >= 0 && data.age <= 120);
      if (!ageOk) {
        response.status(400).send("Age must be a number between 0 and 120, or 'N/A'");
        return;
      }

      // ── Duplicate guard ─────────────────────────────────────────
      // One person = one census record. Blocks a submission whose identity
      // confidently or likely matches an existing record (name+birthday),
      // so re-encoding the same resident twice is prevented.
      const candidates = await ResidentCensusService.findByName(data.name);
      const existing = candidates.find((c) => {
        const level = matchPerson(
          { name: data.name, dob: data.birthday, gender: data.sex, contact: data.cellphone },
          { name: c.name, dob: c.birthday, gender: c.sex, contact: c.cellphone }
        );
        return level === "confident" || level === "likely";
      });
      if (existing) {
        response.status(409).send(
          "A resident with the same name and birthday already exists in the census."
        );
        return;
      }

      const record = await ResidentCensusService.create(data);
      response.status(201).send(record);
    } catch (error: any) {
      console.error(error);
      if (error?.name === "ValidationError") {
        response.status(400).send("Invalid resident census record");
        return;
      }
      response.status(500).send("Failed to create resident census record");
    }
  };

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { purok, search } = request.query;
      const filter: Record<string, any> = {};

      if (purok) filter.purok = purok;
      if (search) {
        filter.$or = [
          { name: { $regex: search as string, $options: "i" } },
          { householdNumber: { $regex: search as string, $options: "i" } },
        ];
      }

      const records = await ResidentCensusService.getAll(filter);
      response.send(records);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to fetch resident census records");
    }
  };

  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid resident census id");
        return;
      }
      const record = await ResidentCensusService.get(id);
      if (!record) {
        response.status(404).send("Resident census record not found");
        return;
      }
      response.send(record);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to fetch resident census record");
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid resident census id");
        return;
      }
      const data: Partial<residentCensusInterfaceInput> = request.body;
      if (data.age !== undefined) {
        const ageOk =
          data.age === "N/A" ||
          (typeof data.age === "number" && data.age >= 0 && data.age <= 120);
        if (!ageOk) {
          response.status(400).send("Age must be a number between 0 and 120, or 'N/A'");
          return;
        }
      }
      const record = await ResidentCensusService.update(id, data);
      if (!record) {
        response.status(404).send("Resident census record not found");
        return;
      }
      // Keep the linked online account in step with the edited census record.
      await ResidentCensusService.syncLinkedAccount(id).catch((err) =>
        console.error("[CENSUS-SYNC ERROR]", err)
      );
      response.send(record);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to update resident census record");
    }
  };

  /**
   * Bulk-import census records from a CSV/Excel export or any JSON array.
   * Accepts { records: [...] } where each row uses the standard census field
   * names (or friendly aliases like "husband"/"birthDate"/"contact"). Every
   * row is identity-checked against the existing census, so re-importing the
   * same file never creates duplicates.
   */
  static importCsv = async (request: AuthRequest, response: Response) => {
    try {
      const records = (request.body?.records ?? []) as Array<Record<string, any>>;
      if (!Array.isArray(records) || records.length === 0) {
        response.status(400).send("A non-empty \"records\" array is required");
        return;
      }
      if (records.length > 10_000) {
        response.status(400).send("Too many records (max 10,000 per import)");
        return;
      }
      const result = await ResidentCensusService.bulkImport(records);
      response.send({ ok: true, imported: result.inserted, skipped: result.skipped });
    } catch (error) {
      console.error("[CENSUS-IMPORT ERROR]", error);
      response.status(500).send("Failed to import resident census records");
    }
  };

  static delete = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid resident census id");
        return;
      }
      const record = await ResidentCensusService.delete(id);
      if (!record) {
        response.status(404).send("Resident census record not found");
        return;
      }
      response.send({ message: "Resident census record deleted successfully" });
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to delete resident census record");
    }
  };
}
