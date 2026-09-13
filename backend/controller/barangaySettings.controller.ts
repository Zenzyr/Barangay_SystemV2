import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { BarangaySettingsService } from "../services/barangaySettings.service";
import { AuditLogService } from "../services/auditLog.service";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";

export class BarangaySettingsController {
  /** Image-URL fields, by section, that must be empty or a valid URL. */
  private static readonly IMAGE_URL_FIELDS: Record<string, string[]> = {
    barangay: ["logoUrl", "sealUrl"],
    documents: ["logoUrl", "sealUrl", "backgroundUrl"],
  };

  /**
   * Trims and validates an image-URL settings value. Accepts an empty string
   * ("not configured"), an app-relative path ("/assets/..."), or an http(s)
   * URL. Rejects everything else (e.g. pasted BBCode), so malformed values can
   * never silently degrade template/PDF output.
   */
  private static cleanImageUrl(raw: any): string | null | undefined {
    if (raw === undefined) return undefined;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return "";
    if (/^https?:\/\/\S+$/i.test(value) || /^\/\S+$/.test(value)) return value;
    return null;
  }

  static get = async (_request: AuthRequest, response: Response) => {
    try {
      const settings = await BarangaySettingsService.get();
      response.send(settings);
    } catch (error: any) {
      console.error("[SETTINGS GET ERROR]", error);
      response.status(500).send("Failed to load settings");
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const before: any = await BarangaySettingsService.get();
      const data: any = request.body ?? {};

      for (const section of Object.keys(this.IMAGE_URL_FIELDS)) {
        const dataSection: any = data[section];
        if (!dataSection || typeof dataSection !== "object") continue;
        for (const field of this.IMAGE_URL_FIELDS[section]) {
          if (!(field in dataSection)) continue;
          const cleaned = this.cleanImageUrl(dataSection[field]);
          if (cleaned === null) {
            throw new Error(
              `${section}.${field} must be empty or a valid image URL (an http(s):// URL or an app-relative /assets/... path).`
            );
          }
          if (cleaned !== undefined) dataSection[field] = cleaned;
        }
      }

      const settings: any = await BarangaySettingsService.upsert(data);

      const changedFields: string[] = [];
      for (const section of ["barangay", "documents", "sms"] as const) {
        if (data[section] && typeof data[section] === "object") {
          if (JSON.stringify(before?.[section]) !== JSON.stringify(settings?.[section])) {
            changedFields.push(section);
          }
        }
      }

      for (const section of changedFields) {
        await AuditLogService.create({
          actor: request.account?.name ?? "System",
          actorId: request.account?._id?.toString?.() ?? "",
          action: "update",
          entity: "barangaySettings",
          entityId: settings?._id?.toString?.() ?? "",
          entityLabel: section === "barangay" ? "Barangay Information" : section === "documents" ? "Document Settings" : "SMS Settings",
          field: section,
          previousValue: before?.[section],
          newValue: settings?.[section],
        });
      }

      response.send(settings);
    } catch (error: any) {
      console.error("[SETTINGS UPDATE ERROR]", error);
      response.status(400).send(error?.message || "Failed to update settings");
    }
  };

  /**
   * Uploads a branding asset (logo or seal) to Cloudinary and stores its URL in
   * the settings document (barangay + documents). Sending no file removes it.
   */
  static uploadAsset = async (request: AuthRequest, response: Response) => {
    try {
      const { kind } = request.params;
      if (kind !== "logo" && kind !== "seal") {
        response.status(400).send("Asset kind must be 'logo' or 'seal'");
        return;
      }

      const current: any = await BarangaySettingsService.get();
      const url = request.file ? await uploadToCloudinary(request.file.path) : "";

      const setField = (obj: any) => ({ ...(obj ?? {}), [`${kind}Url`]: url });
      const updated: any = await BarangaySettingsService.upsert({
        barangay: setField(current.barangay),
        documents: setField(current.documents),
      });

      if (url) {
        await AuditLogService.create({
          actor: request.account?.name ?? "System",
          actorId: request.account?._id?.toString?.() ?? "",
          action: request.body?.remove ? "remove" : "upload",
          entity: "barangaySettings",
          entityId: updated?._id?.toString?.() ?? "",
          entityLabel: kind === "logo" ? "Barangay Logo" : "Barangay Seal",
          field: kind,
          previousValue: current?.barangay?.[`${kind}Url`] ?? "",
          newValue: url,
        });
      }

      response.send(updated);
    } catch (error: any) {
      console.error("[SETTINGS ASSET UPLOAD ERROR]", error);
      response.status(400).send(error?.message || "Failed to upload asset");
    }
  };
}

export default BarangaySettingsController;