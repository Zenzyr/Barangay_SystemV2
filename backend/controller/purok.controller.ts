import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { PurokService } from "../services/purok.service";
import { AuditLogService } from "../services/auditLog.service";
import { purokInterfaceInput } from "../types/purok.type";
import {
  isObjectId,
  isNonEmptyString,
  isName,
  isPhilippineMobile,
  normalizePhMobile,
  withinLength,
  mongooseValidationMessage,
} from "../utils/validation";

const PUROK_NAME_MAX_LENGTH = 100;
const PUROK_LEADER_MAX_LENGTH = 150;
const PUROK_DESCRIPTION_MAX_LENGTH = 500;
const PUROK_NAME_PATTERN = /^[a-zA-ZñÑ0-9\s.'()#&-]+$/;

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
      const body = (request.body ?? {}) as Record<string, unknown>;
      const optionalText = (value: unknown) =>
        typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;

      const rawName = body.name;
      const leader = optionalText(body.leader ?? "");
      const contact = optionalText(body.contact ?? "");
      const description = typeof body.description === "string" ? body.description.trim() : body.description ?? "";
      const status = body.status ?? "active";

      const fail = (field: string, message: string) => {
        response.status(400).json({ message, field });
      };

      if (!isNonEmptyString(rawName)) {
        fail("name", "Purok name is required");
        return;
      }
      const name = rawName.trim().replace(/\s+/g, " ");
      if (!withinLength(name, PUROK_NAME_MAX_LENGTH)) {
        fail("name", `Purok name must be at most ${PUROK_NAME_MAX_LENGTH} characters`);
        return;
      }
      if (!PUROK_NAME_PATTERN.test(name)) {
        fail("name", "Purok name can only contain letters, numbers, spaces, and - . ' ( ) # &");
        return;
      }
      if (typeof leader !== "string" || (leader && !isName(leader))) {
        fail("leader", "Leader name can only contain letters, spaces, periods, hyphens and apostrophes");
        return;
      }
      if (!withinLength(leader, PUROK_LEADER_MAX_LENGTH)) {
        fail("leader", `Leader name must be at most ${PUROK_LEADER_MAX_LENGTH} characters`);
        return;
      }
      if (typeof contact !== "string" || (contact && !isPhilippineMobile(contact))) {
        fail("contact", "Contact must be a valid Philippine mobile number (e.g. 09171234567)");
        return;
      }
      if (typeof description !== "string" || !withinLength(description, PUROK_DESCRIPTION_MAX_LENGTH)) {
        fail("description", `Description must be at most ${PUROK_DESCRIPTION_MAX_LENGTH} characters`);
        return;
      }
      if (status !== "active" && status !== "inactive") {
        fail("status", "Status must be active or inactive");
        return;
      }

      const duplicate = await PurokService.findByName(name);
      if (duplicate) {
        response.status(409).json({ message: `A purok named "${duplicate.name}" already exists`, field: "name" });
        return;
      }

      const data: purokInterfaceInput = {
        name,
        status,
        leader,
        contact: contact ? normalizePhMobile(contact) ?? contact : "",
        description,
      };
      const purok = await PurokService.create(data);

      AuditLogService.create({
        actor: request.account?.name || "System",
        actorId: request.account?._id.toString(),
        action: "create",
        entity: "purok",
        entityId: purok._id.toString(),
        entityLabel: purok.name,
        newValue: purok.status,
      }).catch(() => null);

      response.status(201).send(purok);
    } catch (error: any) {
      console.error("[PUROK CREATE ERROR]", error);
      if (error?.code === 11000 || /duplicate key/i.test(error?.message || "")) {
        response.status(409).json({ message: "A purok with that name already exists", field: "name" });
        return;
      }
      if (error?.name === "ValidationError") {
        const field = Object.keys(error.errors || {})[0];
        response.status(400).json({ message: mongooseValidationMessage(error), field });
        return;
      }
      response.status(500).json({ message: "Failed to create purok" });
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid purok identifier");
        return;
      }
      const existing = await PurokService.get(id);
      const purok = await PurokService.update(id, request.body || {});
      if (!purok) {
        response.status(404).send("Purok not found");
        return;
      }

      AuditLogService.create({
        actor: request.account?.name || "System",
        actorId: request.account?._id.toString(),
        action: "update",
        entity: "purok",
        entityId: id,
        entityLabel: purok.name,
        field: Object.keys(request.body || {}).join(", "),
        previousValue: existing
          ? Object.fromEntries(
              Object.keys(request.body || {}).map((key) => [key, (existing as any)[key]]),
            )
          : undefined,
        newValue: request.body,
      }).catch(() => null);

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
      const existing = await PurokService.get(id);
      const purok = await PurokService.update(id, { status });
      if (!purok) {
        response.status(404).send("Purok not found");
        return;
      }

      AuditLogService.create({
        actor: request.account?.name || "System",
        actorId: request.account?._id.toString(),
        action: "update",
        entity: "purok",
        entityId: id,
        entityLabel: purok.name,
        field: "status",
        previousValue: existing?.status,
        newValue: status,
      }).catch(() => null);

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

      AuditLogService.create({
        actor: request.account?.name || "System",
        actorId: request.account?._id.toString(),
        action: "delete",
        entity: "purok",
        entityId: id,
        entityLabel: purok.name,
        previousValue: purok.status,
      }).catch(() => null);

      response.send({ message: "Purok deleted" });
    } catch (error: any) {
      console.error("[PUROK DELETE ERROR]", error);
      response.status(500).send("Failed to delete purok");
    }
  };
}

export default PurokController;