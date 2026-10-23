import { Router } from "express";
import { ProgramEligibilityController } from "../controller/programEligibility.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// The eligibility picture and enrollment roster are staff-only, same guard as
// Decision Support.
const staffOnly = [authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN)];

// Literal paths before any /:id so ids never shadow them.
route.get("/", ...staffOnly, handler(ProgramEligibilityController.eligibility));
route.get("/enrollments", ...staffOnly, handler(ProgramEligibilityController.listEnrollments));
route.get("/enrollments/summary", ...staffOnly, handler(ProgramEligibilityController.enrollmentSummary));

// Residents (and staff) can view the automatically selected beneficiaries for
// transparency. There is no manual enrollment endpoint: the system picks.
route.get("/beneficiaries", authenticateJWT, handler(ProgramEligibilityController.beneficiaries));

export default route;
