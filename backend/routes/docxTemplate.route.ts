import { Router } from "express";
import { DocxTemplateController } from "../controller/docxTemplate.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();
const STAFF = [ROLES.SECRETARY, ROLES.SUPER_ADMIN] as const;

// Same access model as the PDF template builder: barangay staff manage
// templates; seeding the bundled defaults is super-admin only.
route.get("/", authenticateJWT, requireRoles(...STAFF), handler(DocxTemplateController.list));
route.get("/variables", authenticateJWT, requireRoles(...STAFF), handler(DocxTemplateController.variables));
route.post("/seed", authenticateJWT, requireRoles(ROLES.SUPER_ADMIN), handler(DocxTemplateController.seed));
// Any authenticated user (residents included) may render the template bound to
// a document type for their own request. Registered before "/:id".
route.post("/render-by-type", authenticateJWT, handler(DocxTemplateController.renderByType));
route.get("/:id", authenticateJWT, requireRoles(...STAFF), handler(DocxTemplateController.get));
route.put("/:id", authenticateJWT, requireRoles(...STAFF), handler(DocxTemplateController.update));
route.post("/:id/duplicate", authenticateJWT, requireRoles(...STAFF), handler(DocxTemplateController.duplicate));
route.post("/:id/export", authenticateJWT, requireRoles(...STAFF), handler(DocxTemplateController.exportDocx));
route.delete("/:id", authenticateJWT, requireRoles(...STAFF), handler(DocxTemplateController.remove));

export default route;
