import { Router } from "express";
import { DocumentTemplateController } from "../controller/documentTemplate.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();
const STAFF = [ROLES.SECRETARY, ROLES.SUPER_ADMIN] as const;

// Active templates are read by residents+staff to drive fees & dropdowns.
route.get("/public", authenticateJWT, handler(DocumentTemplateController.getPublic));

// Management endpoints are restricted to barangay staff.
route.get("/", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.getAll));
route.get("/:id", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.get));
route.post("/", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.create));
route.post("/seed", authenticateJWT, requireRoles(ROLES.SUPER_ADMIN), handler(DocumentTemplateController.seed));
// Any authenticated user (residents included) may render the template bound to
// a document type for their own request. Registered before the "/:id" routes.
route.post("/render-by-type", authenticateJWT, handler(DocumentTemplateController.renderByType));
route.put("/:id", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.update));
route.post("/preview", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.previewContent));
route.get("/:id/editor-content", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.getEditorContent));
route.post("/:id/duplicate", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.duplicate));
route.post("/:id/render", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.renderDocument));
route.get("/:id/preview", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.preview));
route.delete("/:id", authenticateJWT, requireRoles(...STAFF), handler(DocumentTemplateController.remove));

export default route;