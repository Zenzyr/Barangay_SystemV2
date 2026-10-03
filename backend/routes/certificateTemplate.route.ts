import { Router } from "express";
import { CertificateTemplateController } from "../controller/certificateTemplate.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";

const router = Router();
const MANAGERS = [ROLES.SECRETARY] as const;

router.get("/", authenticateJWT, CertificateTemplateController.getAll);
router.post("/", authenticateJWT, requireRoles(...MANAGERS), CertificateTemplateController.create);
router.get("/generate/:templateId/:documentId", authenticateJWT, CertificateTemplateController.generate);
router.put("/:id", authenticateJWT, requireRoles(...MANAGERS), CertificateTemplateController.update);
router.delete("/:id", authenticateJWT, requireRoles(...MANAGERS), CertificateTemplateController.delete);

export default router;
