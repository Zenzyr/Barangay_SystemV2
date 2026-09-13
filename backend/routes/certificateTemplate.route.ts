import { Router } from "express";
import { CertificateTemplateController } from "../controller/certificateTemplate.controller";

const router = Router();

router.get("/", CertificateTemplateController.getAll);
router.post("/", CertificateTemplateController.create);
router.get("/generate/:templateId/:documentId", CertificateTemplateController.generate);
router.put("/:id", CertificateTemplateController.update);
router.delete("/:id", CertificateTemplateController.delete);

export default router;
