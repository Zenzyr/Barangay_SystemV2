import { Router } from "express";
import { ProgramEligibilityController } from "../controller/programEligibility.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// Program eligibility + beneficiary management is staff-only, same guard as
// Decision Support.
const staffOnly = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];

// Literal paths before any /:id so ids never shadow them.
route.get("/", ...staffOnly, handler(ProgramEligibilityController.eligibility));
route.get("/enrollments", ...staffOnly, handler(ProgramEligibilityController.listEnrollments));
route.get("/enrollments/summary", ...staffOnly, handler(ProgramEligibilityController.enrollmentSummary));
route.post("/enrollments", ...staffOnly, handler(ProgramEligibilityController.enroll));
route.delete("/enrollments/:id", ...staffOnly, handler(ProgramEligibilityController.removeEnrollment));

export default route;
