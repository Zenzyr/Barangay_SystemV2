import { Router } from "express";
import { WorkController } from "../controller/work.controller";
import { authenticateJWT } from "../middleware/auth";
import { handler } from "../utils/handler";

const route = Router()

route.get("/client/:clientId", authenticateJWT, handler(WorkController.getByClient))
route.get("/worker/:workerId", authenticateJWT, handler(WorkController.getByWorker))
route.patch("/:id/status", authenticateJWT, handler(WorkController.updateStatus))

export default route
