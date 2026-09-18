import { Router } from "express";
import { AccountController } from "../controller/accounts.controller";
import { uploadIdImages, uploadProfilePicMiddleware, uploadIdFrontBack } from "../utils/upload";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router()

// Operational staff guards
const staffOnly = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];
const superAdminOnly = [authenticateJWT, requireRoles(ROLES.SUPER_ADMIN)];

// AI use endpoints stay available to signed-in/guest flows (resident chatbot).
route.post("/book", authenticateJWT, handler(AccountController.bookWork))
route.post("/ai", handler(AccountController.aiChatBot))
route.post("/ai-suggestion", handler(AccountController.aiSuggestions))
// AI context is system configuration: staff may read it (decision support);
// only super admin may edit it.
route.get("/ai-context", ...staffOnly, handler(AccountController.getAiContext))
route.put("/ai-context", ...superAdminOnly, handler(AccountController.upsertAiContext))

route.post("/", uploadIdImages, handler(AccountController.register))
// Pre-registration identity check (UX only — register() re-validates).
route.post("/check-duplicate", handler(AccountController.checkDuplicate))
// Read-only possible-duplicate report for administrator review.
route.get("/duplicates/report", ...superAdminOnly, handler(AccountController.duplicatesReport))
route.post("/verify-id", handler(AccountController.verifyIdImage))
route.post("/verify-id-document", uploadIdFrontBack, handler(AccountController.verifyIdDocument))
route.post("/login", handler(AccountController.login))
route.post("/forgot-password", handler(AccountController.forgotPassword))
route.post("/verify-reset-code", handler(AccountController.verifyResetCode))
route.post("/reset-password", handler(AccountController.resetPassword))

// Account listings and resident verification are operational staff actions.
route.get("/", ...staffOnly, handler(AccountController.getAll))
route.get("/activity/:id", authenticateJWT, handler(AccountController.getActivityByResident))
route.get("/residents/skills", handler(AccountController.getResidentsWithSkills))
route.patch("/:id/status", ...staffOnly, handler(AccountController.updateStatus))
// Role assignment is super admin only.
route.patch("/:id/role", ...superAdminOnly, handler(AccountController.updateRole))
route.put("/:id/resubmit", uploadIdImages, handler(AccountController.resubmitImages))

route.get("/:id", authenticateJWT, handler(AccountController.getProfile))
route.post("/:id/skills", authenticateJWT, handler(AccountController.addSkill))
route.delete("/:id/skills/:skillId", authenticateJWT, handler(AccountController.removeSkill))
route.patch("/:id/availability", authenticateJWT, handler(AccountController.updateAvailability))
route.post("/:id/reviews", authenticateJWT, handler(AccountController.addReview))
route.put("/:id/profile-pic", authenticateJWT, uploadProfilePicMiddleware, handler(AccountController.uploadProfilePic))
route.patch("/:id/info", authenticateJWT, handler(AccountController.updateInfo))
route.patch("/:id/password", authenticateJWT, handler(AccountController.changePassword))

export default route