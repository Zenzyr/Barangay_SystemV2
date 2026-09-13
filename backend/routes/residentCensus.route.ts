import { Router } from "express";
import { ResidentCensusController } from "../controller/residentCensus.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

// Resident census is operational barangay data — staff manage it. Regular
// residents are not allowed to write or list the census.
route.get("/", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(ResidentCensusController.getAll));
route.get("/:id", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(ResidentCensusController.get));
route.post("/", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(ResidentCensusController.create));
route.put("/:id", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(ResidentCensusController.update));
route.delete("/:id", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(ResidentCensusController.delete));

export default route;