import { Router } from "express";
import { TransactionController } from "../controller/transaction.controller";
import { authenticateJWT, requirePermissions } from "../middleware/auth";
import { PERMISSIONS } from "../utils/roles";
import { handler } from "../utils/handler";

const route = Router();

route.get("/", authenticateJWT, requirePermissions(PERMISSIONS.PAYMENTS_VIEW), handler(TransactionController.getAll));
route.get("/mine", authenticateJWT, handler(TransactionController.getMine));
route.get("/residents", authenticateJWT, requirePermissions(PERMISSIONS.PAYMENTS_VIEW), handler(TransactionController.getResidentOptions));
route.get("/summary", authenticateJWT, requirePermissions(PERMISSIONS.TREASURER_DASHBOARD_VIEW), handler(TransactionController.getSummary));
route.get("/:id/receipt", authenticateJWT, handler(TransactionController.getReceipt));
route.post("/:id/receipt/reprint", authenticateJWT, requirePermissions(PERMISSIONS.RECEIPTS_REPRINT), handler(TransactionController.logReprint));
route.get("/:id", authenticateJWT, requirePermissions(PERMISSIONS.PAYMENTS_DETAILS_VIEW), handler(TransactionController.getDetail));
route.patch("/:id/verify", authenticateJWT, requirePermissions(PERMISSIONS.PAYMENTS_VERIFY), handler(TransactionController.verify));
route.patch("/:id/reject", authenticateJWT, requirePermissions(PERMISSIONS.PAYMENTS_REJECT), handler(TransactionController.reject));
route.patch("/:id/correct", authenticateJWT, requirePermissions(PERMISSIONS.PAYMENTS_CORRECT), handler(TransactionController.correct));

export default route;
