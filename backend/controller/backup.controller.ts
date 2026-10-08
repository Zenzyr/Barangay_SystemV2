import { Response } from "express";
import fs from "fs";
import { AuthRequest } from "../types/request.type";
import { BackupService } from "../services/backup.service";
import { AuditLogService } from "../services/auditLog.service";

export class BackupController {
  static create = async (request: AuthRequest, response: Response) => {
    try {
      const metadata = await BackupService.createBackup({
        id: request.account?._id,
        name: request.account?.name,
      });
      AuditLogService.create({
        actor: request.account?.name || "System",
        actorId: request.account?._id.toString(),
        action: "create",
        entity: "backup",
        entityId: metadata._id.toString(),
        entityLabel: metadata.filename,
        field: "file",
        newValue: metadata.sizeBytes,
      }).catch(() => null);
      return response.status(201).json(metadata);
    } catch (error) {
      console.error("[BACKUP CREATE ERROR]", error);
      return response.status(500).send("Failed to create backup");
    }
  };

  static list = async (_request: AuthRequest, response: Response) => {
    try {
      const backups = await BackupService.listBackups();
      return response.json(backups);
    } catch (error) {
      console.error("[BACKUP LIST ERROR]", error);
      return response.status(500).send("Failed to fetch backups");
    }
  };

  static download = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const resolved = await BackupService.resolveBackupFilePath(id);
      if (!resolved) {
        return response.status(404).send("Backup not found");
      }
      response.setHeader("Content-Type", "application/json");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${resolved.filename}"`
      );
      const stream = fs.createReadStream(resolved.filePath);
      stream.on("error", () => {
        response.status(500).end();
      });
      AuditLogService.create({
        actor: request.account?.name || "System",
        actorId: request.account?._id.toString(),
        action: "download",
        entity: "backup",
        entityId: id,
        entityLabel: resolved.filename,
      }).catch(() => null);
      stream.pipe(response);
    } catch (error) {
      console.error("[BACKUP DOWNLOAD ERROR]", error);
      return response.status(500).send("Failed to download backup");
    }
  };

  static restore = async (request: AuthRequest, response: Response) => {
    const file = request.file;
    try {
      if (!file || !file.buffer || file.buffer.length === 0) {
        return response.status(400).send("A backup (.json) file is required");
      }

      const results = await BackupService.restoreFromBuffer(file.buffer);
      AuditLogService.create({
        actor: request.account?.name || "System",
        actorId: request.account?._id.toString(),
        action: "restore",
        entity: "backup",
        entityId: file.originalname,
        entityLabel: file.originalname,
        field: "collections",
        newValue: results.map((r) => `${r.name}: ${r.restored}${r.merged ? " (merged)" : ""}`),
      }).catch(() => null);
      return response.status(200).json({ collections: results });
    } catch (error: any) {
      console.error("[BACKUP RESTORE ERROR]", error);
      AuditLogService.create({
        actor: request.account?.name || "System",
        actorId: request.account?._id.toString(),
        action: "restore_failed",
        entity: "backup",
        entityId: file?.originalname || "",
        entityLabel: file?.originalname || "Unknown file",
        newValue: error?.message || "Failed to restore backup",
      }).catch(() => null);
      return response.status(400).send(error?.message || "Failed to restore backup");
    }
  };
}
