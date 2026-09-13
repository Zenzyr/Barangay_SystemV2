import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ResidentCensusService } from "../services/residentCensus.service";
import { residentCensusInterfaceInput } from "../types/residentCensus.type";
import { isObjectId, isName, isNonEmptyString } from "../utils/validation";

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
      response.send(record);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to update resident census record");
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
