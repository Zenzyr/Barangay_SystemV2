import { Router } from "express";
import { BackupController } from "../controller/backup.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";
import { uploadBackup } from "../utils/upload";

const route = Router();


const superAdminOnly = [authenticateJWT, requireRoles(ROLES.SUPER_ADMIN)];

route.get("/", ...superAdminOnly, handler(BackupController.list));
route.post("/", ...superAdminOnly, handler(BackupController.create));
route.get("/:id/download", ...superAdminOnly, handler(BackupController.download));
route.post(
  "/restore",
  ...superAdminOnly,
  uploadBackup.single("backupFile"),
  handler(BackupController.restore)
);

export default route;
