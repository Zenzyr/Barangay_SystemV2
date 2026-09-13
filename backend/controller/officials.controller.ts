import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { OfficialService } from "../services/official.service";
import { AuditLogService } from "../services/auditLog.service";
import { officialInterfaceInput, SINGLE_HOLDER_POSITIONS } from "../types/official.type";
import { isObjectId, isNonEmptyString } from "../utils/validation";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";

function actorOf(request: AuthRequest) {
  return {
    name: request.account?.name ?? "System",
    id: request.account?._id?.toString?.() ?? "",
  };
}

export class OfficialsController {
  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { position, status } = request.query;
      const filter: Record<string, any> = {};
      if (position) filter.position = position;
      if (status) filter.status = status;
      const officials = await OfficialService.getAll(filter);
      response.send(officials);
    } catch (error: any) {
      console.error("[OFFICIALS GET ALL ERROR]", error);
      response.status(500).send("Failed to load officials");
    }
  };

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const data = request.body as officialInterfaceInput;
      if (!isNonEmptyString(data.fullName)) {
        response.status(400).send("Full name is required");
        return;
      }
      if (!isNonEmptyString(data.position)) {
        response.status(400).send("Position is required");
        return;
      }
      if (data.status !== "active" && data.status !== "inactive") {
        response.status(400).send("Status must be active or inactive");
        return;
      }

      const { official, replaced } = await OfficialService.createWithReplacement(data, actorOf(request));

      await AuditLogService.create({
        actor: actorOf(request).name,
        actorId: actorOf(request).id,
        action: "create",
        entity: "official",
        entityId: official._id.toString(),
        entityLabel: `${official.fullName} (${official.position})`,
        field: "all",
        previousValue: replaced ? { fullName: replaced.fullName, status: "active" } : null,
        newValue: { fullName: official.fullName, status: official.status },
      });

      if (replaced) {
        await AuditLogService.create({
          actor: actorOf(request).name,
          actorId: actorOf(request).id,
          action: "replace",
          entity: "official",
          entityId: replaced._id.toString(),
          entityLabel: `${replaced.fullName} (${replaced.position})`,
          field: "status",
          previousValue: "active",
          newValue: "inactive",
        });
      }

      response.status(201).send(official);
    } catch (error: any) {
      console.error("[OFFICIALS CREATE ERROR]", error);
      if (error?.code === 11000 || /duplicate key/i.test(error?.message || "")) {
        response.status(409).send(`An active ${request.body?.position} already exists. Deactivate it first to replace the current holder.`);
        return;
      }
      response.status(400).send(error?.message || "Failed to create official");
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid official identifier");
        return;
      }
      const current = await OfficialService.get(id);
      if (!current) {
        response.status(404).send("Official not found");
        return;
      }

      const before = {
        fullName: current.fullName,
        position: current.position,
        status: current.status,
      };
      const data = request.body as Partial<officialInterfaceInput>;

      const { official, replaced } = await OfficialService.updateWithReplacement(id, data, actorOf(request));

      const after = {
        fullName: official.fullName,
        position: official.position,
        status: official.status,
      };
      await AuditLogService.create({
        actor: actorOf(request).name,
        actorId: actorOf(request).id,
        action: "update",
        entity: "official",
        entityId: id,
        entityLabel: `${after.fullName} (${after.position})`,
        field: "profile/status",
        previousValue: before,
        newValue: after,
      });
      if (replaced) {
        await AuditLogService.create({
          actor: actorOf(request).name,
          actorId: actorOf(request).id,
          action: "replace",
          entity: "official",
          entityId: replaced._id.toString(),
          entityLabel: `${replaced.fullName} (${replaced.position})`,
          field: "status",
          previousValue: "active",
          newValue: "inactive",
        });
      }

      response.send(official);
    } catch (error: any) {
      console.error("[OFFICIALS UPDATE ERROR]", error);
      if (error?.code === 11000 || /duplicate key/i.test(error?.message || "")) {
        response.status(409).send(`An active ${request.body?.position} already exists.`);
        return;
      }
      response.status(400).send(error?.message || "Failed to update official");
    }
  };

  static setStatus = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid official identifier");
        return;
      }
      const status = request.body?.status;
      if (status !== "active" && status !== "inactive") {
        response.status(400).send("Status must be active or inactive");
        return;
      }

      const current = await OfficialService.get(id);
      if (!current) {
        response.status(404).send("Official not found");
        return;
      }

      let replaced: any = null;
      if (
        status === "active" &&
        SINGLE_HOLDER_POSITIONS.includes(current.position as any)
      ) {
        const existing = await OfficialService.getActiveByPosition(current.position);
        if (existing && existing._id.toString() !== id) {
          await OfficialService.update(existing._id.toString(), { status: "inactive" });
          replaced = existing;
        }
      }

      const updated = await OfficialService.update(id, { status });
      if (!updated) {
        response.status(404).send("Official not found");
        return;
      }
      const official = updated;

      await AuditLogService.create({
        actor: actorOf(request).name,
        actorId: actorOf(request).id,
        action: status === "active" ? "activate" : "deactivate",
        entity: "official",
        entityId: id,
        entityLabel: `${official.fullName} (${official.position})`,
        field: "status",
        previousValue: current.status,
        newValue: status,
      });
      if (replaced) {
        await AuditLogService.create({
          actor: actorOf(request).name,
          actorId: actorOf(request).id,
          action: "replace",
          entity: "official",
          entityId: replaced._id.toString(),
          entityLabel: `${replaced.fullName} (${replaced.position})`,
          field: "status",
          previousValue: "active",
          newValue: "inactive",
        });
      }

      response.send(official);
    } catch (error: any) {
      console.error("[OFFICIALS STATUS ERROR]", error);
      if (error?.code === 11000 || /duplicate key/i.test(error?.message || "")) {
        response.status(409).send(`An active ${request.body?.position ?? "official"} already exists.`);
        return;
      }
      response.status(400).send(error?.message || "Failed to update status");
    }
  };

  static delete = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid official identifier");
        return;
      }
      const official = await OfficialService.get(id);
      if (!official) {
        response.status(404).send("Official not found");
        return;
      }
      await OfficialService.delete(id);
      await AuditLogService.create({
        actor: actorOf(request).name,
        actorId: actorOf(request).id,
        action: "delete",
        entity: "official",
        entityId: id,
        entityLabel: `${official.fullName} (${official.position})`,
      });
      response.send({ message: "Official deleted" });
    } catch (error: any) {
      console.error("[OFFICIALS DELETE ERROR]", error);
      response.status(500).send("Failed to delete official");
    }
  };

  /**
   * Uploads an asset (photo or signature) for an official and stores its URL.
   */
  static uploadAsset = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid official identifier");
        return;
      }
      const { kind } = request.body ?? {};
      if (kind !== "photo" && kind !== "signature") {
        response.status(400).send("Asset kind must be 'photo' or 'signature'");
        return;
      }
      if (!request.file) {
        response.status(400).send("No file provided");
        return;
      }
      const official = await OfficialService.get(id);
      if (!official) {
        response.status(404).send("Official not found");
        return;
      }

      const url = await uploadToCloudinary(request.file.path);
      const updateData = kind === "photo" ? { photo: url } : { signatureImage: url };
      const updated = await OfficialService.update(id, updateData);

      await AuditLogService.create({
        actor: actorOf(request).name,
        actorId: actorOf(request).id,
        action: "upload",
        entity: "official",
        entityId: id,
        entityLabel: `${official.fullName} (${official.position})`,
        field: kind,
        previousValue: (official as any)?.[kind === "photo" ? "photo" : "signatureImage"] ?? "",
        newValue: url,
      });

      response.send(updated);
    } catch (error: any) {
      console.error("[OFFICIALS ASSET UPLOAD ERROR]", error);
      response.status(400).send(error?.message || "Failed to upload asset");
    }
  };
}

export default OfficialsController;