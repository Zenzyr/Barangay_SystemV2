import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { PurokService } from "../services/purok.service";
import { purokInterfaceInput } from "../types/purok.type";
import { isObjectId, isNonEmptyString } from "../utils/validation";

export class PurokController {
  static getAll = async (_request: AuthRequest, response: Response) => {
    try {
      const { status } = _request.query;
      const filter: Record<string, any> = {};
      if (status) filter.status = status;
      const puroks = await PurokService.getAll(filter);
      response.send(puroks);
    } catch (error: any) {
      console.error("[PUROK GET ALL ERROR]", error);
      response.status(500).send("Failed to load puroks");
    }
  };

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const data = request.body as purokInterfaceInput;
      if (!isNonEmptyString(data.name)) {
        response.status(400).send("Purok name is required");
        return;
      }
      const purok = await PurokService.create(data);
      response.status(201).send(purok);
    } catch (error: any) {
      console.error("[PUROK CREATE ERROR]", error);
      if (error?.code === 11000 || /duplicate key/i.test(error?.message || "")) {
        response.status(409).send("A purok with that name already exists");
        return;
      }
      response.status(400).send(error?.message || "Failed to create purok");
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid purok identifier");
        return;
      }
      const purok = await PurokService.update(id, request.body || {});
      if (!purok) {
        response.status(404).send("Purok not found");
        return;
      }
      response.send(purok);
    } catch (error: any) {
      console.error("[PUROK UPDATE ERROR]", error);
      if (error?.code === 11000 || /duplicate key/i.test(error?.message || "")) {
        response.status(409).send("A purok with that name already exists");
        return;
      }
      response.status(400).send(error?.message || "Failed to update purok");
    }
  };

  static setStatus = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { status } = request.body ?? {};
      if (!isObjectId(id)) {
        response.status(400).send("Invalid purok identifier");
        return;
      }
      if (status !== "active" && status !== "inactive") {
        response.status(400).send("Status must be active or inactive");
        return;
      }
      const purok = await PurokService.update(id, { status });
      if (!purok) {
        response.status(404).send("Purok not found");
        return;
      }
      response.send(purok);
    } catch (error: any) {
      console.error("[PUROK STATUS ERROR]", error);
      response.status(400).send(error?.message || "Failed to update purok status");
    }
  };

  static getResidents = async (request: AuthRequest, response: Response) => {
    try {
      const purokName = String(request.params.name || "");
      if (!purokName) {
        response.status(400).send("Purok name is required");
        return;
      }
      const residents = await PurokService.getResidents(purokName);
      response.send(residents);
    } catch (error: any) {
      console.error("[PUROK RESIDENTS ERROR]", error);
      response.status(500).send("Failed to load purok residents");
    }
  };

  static getCensus = async (request: AuthRequest, response: Response) => {
    try {
      const purokName = String(request.params.name || "");
      if (!purokName) {
        response.status(400).send("Purok name is required");
        return;
      }
      const census = await PurokService.getCensus(purokName);
      response.send(census);
    } catch (error: any) {
      console.error("[PUROK CENSUS ERROR]", error);
      response.status(500).send("Failed to load purok census");
    }
  };

  static delete = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid purok identifier");
        return;
      }
      const purok = await PurokService.delete(id);
      if (!purok) {
        response.status(404).send("Purok not found");
        return;
      }
      response.send({ message: "Purok deleted" });
    } catch (error: any) {
      console.error("[PUROK DELETE ERROR]", error);
      response.status(500).send("Failed to delete purok");
    }
  };
}

export default PurokController;