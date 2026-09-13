import { Router } from "express";
import { ServiceRequestController } from "../controller/serviceRequest.controller";
import { authenticateJWT } from "../middleware/auth";
import { handler } from "../utils/handler";

const route = Router();

route.post("/", authenticateJWT, handler(ServiceRequestController.create));
route.get("/mine", authenticateJWT, handler(ServiceRequestController.getMine));
route.get("/received", authenticateJWT, handler(ServiceRequestController.getReceived));
route.patch("/:id/accept", authenticateJWT, handler(ServiceRequestController.accept));
route.patch("/:id/reject", authenticateJWT, handler(ServiceRequestController.reject));

export default route;
