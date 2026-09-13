import { Router } from "express";
import { DocumentRequestController } from "../controller/documentRequest.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";
import { uploadDocx } from "../utils/upload";

const route = Router()

route.post("/", authenticateJWT, handler(DocumentRequestController.create))
route.post("/to-pdf", authenticateJWT, uploadDocx.single("file"), handler(DocumentRequestController.convertToPdf))

// Document request data is no longer public — require an authenticated account.
// Status updates (processing/generating/issuing) are operational staff only.
route.get("/", authenticateJWT, handler(DocumentRequestController.getAll))
route.get("/:id", authenticateJWT, handler(DocumentRequestController.get))
route.get("/resident/:residentId", authenticateJWT, handler(DocumentRequestController.getByResident))
route.patch("/:id/status", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(DocumentRequestController.updateStatus))

route.put("/:id", authenticateJWT, handler(DocumentRequestController.update))
route.patch("/:id/payment", authenticateJWT, handler(DocumentRequestController.updatePayment))
route.patch("/:id/snapshot", authenticateJWT, handler(DocumentRequestController.saveSnapshot))
route.delete("/:id", authenticateJWT, handler(DocumentRequestController.delete))
route.post("/:id/payment/online", authenticateJWT, handler(DocumentRequestController.onlinePayment))
route.post("/:id/session", authenticateJWT, handler(DocumentRequestController.saveCheckoutSession))


export default route