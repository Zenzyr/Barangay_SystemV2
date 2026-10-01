import { Router } from "express";
import { TransactionController } from "../controller/transaction.controller";
import { authenticateJWT, requireRoles } from "../middleware/auth";
import { ROLES } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

route.get("/", authenticateJWT, requireRoles(ROLES.SECRETARY, ROLES.SUPER_ADMIN), handler(TransactionController.getAll));
route.get("/mine", authenticateJWT, handler(TransactionController.getMine));
route.get("/:id/receipt", authenticateJWT, handler(TransactionController.getReceipt));

export default route;
