import { Router } from "express";
import { BusinessController } from "../controller/business.controller";
import { uploadBusinessFiles, uploadBusinessImages } from "../utils/upload";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router()

route.post("/", authenticateJWT, uploadBusinessFiles, handler(BusinessController.create))
route.get("/", authenticateJWT, handler(BusinessController.getAll))
route.get("/resident/:id", authenticateJWT, handler(BusinessController.getByResident))
route.get("/:id", authenticateJWT, handler(BusinessController.get))
route.put("/:id", authenticateJWT, uploadBusinessFiles, handler(BusinessController.update))
route.delete("/:id", authenticateJWT, handler(BusinessController.delete))
// Approving/rejecting a business registration is an operational staff action.
route.patch("/:id/status", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(BusinessController.updateStatus))
route.post("/:id/images", authenticateJWT, uploadBusinessImages, handler(BusinessController.addImages))
route.delete("/:id/images", authenticateJWT, handler(BusinessController.removeImage))

export default route
