import { Router } from "express";
import { DocumentTemplateController } from "../controller/documentTemplate.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();
const STAFF = [ROLES.SECRETARY, ROLES.SUPER_ADMIN] as const;
const MANAGERS = [ROLES.SECRETARY] as const;

// Active templates are read by residents+staff to drive fees & dropdowns.
route.get(
  "/public",
  authenticateJWT,
  handler(DocumentTemplateController.getPublic),
);

// Management endpoints are restricted to barangay staff.
route.get(
  "/",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.getAll),
);
route.get(
  "/pending-approvals",
  authenticateJWT,
  requireRoles(...STAFF),
  handler(DocumentTemplateController.getPendingApprovals),
);
route.patch(
  "/:id/price/approve",
  authenticateJWT,
  requireRoles(ROLES.SUPER_ADMIN),
  handler(DocumentTemplateController.approvePrice),
);
route.patch(
  "/:id/price/reject",
  authenticateJWT,
  requireRoles(ROLES.SUPER_ADMIN),
  handler(DocumentTemplateController.rejectPrice),
);
route.get(
  "/:id",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.get),
);
route.post(
  "/",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.create),
);
route.post(
  "/seed",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.seed),
);
// Any authenticated user (residents included) may render the template bound to
// a document type for their own request. Registered before the "/:id" routes.
route.post(
  "/render-by-type",
  authenticateJWT,
  handler(DocumentTemplateController.renderByType),
);
route.put(
  "/:id",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.update),
);
route.post(
  "/preview",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.previewContent),
);
route.get(
  "/:id/editor-content",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.getEditorContent),
);
route.post(
  "/:id/duplicate",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.duplicate),
);
route.post(
  "/:id/render",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.renderDocument),
);
route.get(
  "/:id/preview",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.preview),
);
route.delete(
  "/:id",
  authenticateJWT,
  requireRoles(...MANAGERS),
  handler(DocumentTemplateController.remove),
);

export default route;
