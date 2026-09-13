import { Router } from "express";
import { OfficialsController } from "../controller/officials.controller";
import { BarangaySettingsController } from "../controller/barangaySettings.controller";
import { AuditLogController } from "../controller/auditLog.controller";
import { PurokController } from "../controller/purok.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";
import { uploadSettingLogo, uploadSettingSeal, uploadOfficialPhoto, uploadOfficialSignature } from "../utils/upload";

const route = Router();

// Operational staff (secretary runs the office; super admin may also operate).
const staffOnly = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];
// System/legislative configuration is super admin only.
const superAdminOnly = [authenticateJWT, requireRoles(ROLES.SUPER_ADMIN)];

// Barangay settings (read is public; writes are super admin only)
route.get("/settings", handler(BarangaySettingsController.get));
route.put("/settings", ...superAdminOnly, handler(BarangaySettingsController.update));
route.post("/settings/upload/logo", ...superAdminOnly, uploadSettingLogo, handler(BarangaySettingsController.uploadAsset));
route.post("/settings/upload/seal", ...superAdminOnly, uploadSettingSeal, handler(BarangaySettingsController.uploadAsset));

// Officials directory (read is public; management is super admin only)
route.get("/officials", handler(OfficialsController.getAll));
route.post("/officials", ...superAdminOnly, handler(OfficialsController.create));
route.put("/officials/:id", ...superAdminOnly, handler(OfficialsController.update));
route.patch("/officials/:id/status", ...superAdminOnly, handler(OfficialsController.setStatus));
route.post("/officials/:id/upload/photo", ...superAdminOnly, uploadOfficialPhoto, handler(OfficialsController.uploadAsset));
route.post("/officials/:id/upload/signature", ...superAdminOnly, uploadOfficialSignature, handler(OfficialsController.uploadAsset));
route.delete("/officials/:id", ...superAdminOnly, handler(OfficialsController.delete));

// Purok settings (read is public; configuration is super admin only;
// resident/census queries are operational for staff)
route.get("/puroks", handler(PurokController.getAll));
route.post("/puroks", ...superAdminOnly, handler(PurokController.create));
route.put("/puroks/:id", ...superAdminOnly, handler(PurokController.update));
route.patch("/puroks/:id/status", ...superAdminOnly, handler(PurokController.setStatus));
route.get("/puroks/:name/residents", ...staffOnly, handler(PurokController.getResidents));
route.get("/puroks/:name/census", ...staffOnly, handler(PurokController.getCensus));
route.delete("/puroks/:id", ...superAdminOnly, handler(PurokController.delete));

// Audit trail (operational staff may view; full administration is super admin)
route.get("/audit", ...staffOnly, handler(AuditLogController.getAll));

export default route;