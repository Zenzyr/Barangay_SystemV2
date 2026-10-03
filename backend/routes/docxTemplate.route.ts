import { Router } from "express";
import { DocxTemplateController } from "../controller/docxTemplate.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";
import { uploadDocx } from "../utils/upload";

const route = Router();
const MANAGERS = [ROLES.SECRETARY] as const;

// Same access model as the PDF template builder: barangay staff manage
// templates; seeding the bundled defaults is super-admin only.
route.get("/", authenticateJWT, requireRoles(...MANAGERS), handler(DocxTemplateController.list));
route.get("/variables", authenticateJWT, requireRoles(...MANAGERS), handler(DocxTemplateController.variables));
route.post("/seed", authenticateJWT, requireRoles(...MANAGERS), handler(DocxTemplateController.seed));
// Any authenticated user (residents included) may render the template bound to
// a document type for their own request. Registered before "/:id".
route.post("/render-by-type", authenticateJWT, handler(DocxTemplateController.renderByType));
route.get("/:id", authenticateJWT, requireRoles(...MANAGERS), handler(DocxTemplateController.get));
route.put("/:id", authenticateJWT, requireRoles(...MANAGERS), handler(DocxTemplateController.update));
route.post("/:id/duplicate", authenticateJWT, requireRoles(...MANAGERS), handler(DocxTemplateController.duplicate));
route.post("/:id/export", authenticateJWT, requireRoles(...MANAGERS), handler(DocxTemplateController.exportDocx));
// Phase 1 of DOCX template fidelity: store/stream the original DOCX package
// (staff-only). The editor flow above is untouched.
route.post(
  "/:id/upload-original",
  authenticateJWT,
  requireRoles(...MANAGERS),
  uploadDocx.single("file"),
  handler(DocxTemplateController.uploadOriginalDocx)
);
route.get(
  "/:id/original-docx",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocxTemplateController.getOriginalDocx)
);
route.delete("/:id", authenticateJWT, requireRoles(...MANAGERS), handler(DocxTemplateController.remove));

export default route;
