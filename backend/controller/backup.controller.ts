import { Response } from "express";
import fs from "fs";
import { AuthRequest } from "../types/request.type";
import { BackupService } from "../services/backup.service";

export class BackupController {
  static create = async (request: AuthRequest, response: Response) => {
    try {
      const metadata = await BackupService.createBackup({
        id: request.account?._id,
        name: request.account?.name,
      });
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
      stream.pipe(response);
    } catch (error) {
      console.error("[BACKUP DOWNLOAD ERROR]", error);
      return response.status(500).send("Failed to download backup");
    }
  };

  static restore = async (request: AuthRequest, response: Response) => {
    try {
      const file = request.file;
      if (!file || !file.buffer || file.buffer.length === 0) {
        return response.status(400).send("A backup (.json) file is required");
      }

      const results = await BackupService.restoreFromBuffer(file.buffer);
      return response.status(200).json({ collections: results });
    } catch (error: any) {
      console.error("[BACKUP RESTORE ERROR]", error);
      return response.status(400).send(error?.message || "Failed to restore backup");
    }
  };
}
