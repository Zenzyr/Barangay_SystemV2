import { Router } from "express";
import { ContractController } from "../controller/contract.controller";
import { authenticateJWT } from "../middleware/auth";
import { handler } from "../utils/handler";

const route = Router();

route.get("/mine", authenticateJWT, handler(ContractController.getMine));
route.get("/provider", authenticateJWT, handler(ContractController.getProvider));
route.get("/:id", authenticateJWT, handler(ContractController.get));
route.patch("/:id/request-completion", authenticateJWT, handler(ContractController.requestCompletion));
route.patch("/:id/confirm-completion", authenticateJWT, handler(ContractController.confirmCompletion));

export default route;
