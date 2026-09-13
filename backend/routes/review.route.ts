import { Router } from "express";
import { ReviewController } from "../controller/review.controller";
import { authenticateJWT } from "../middleware/auth";
import { handler } from "../utils/handler";

const route = Router();

route.post("/", authenticateJWT, handler(ReviewController.create));
route.get("/provider/:providerId", handler(ReviewController.getByProvider));
route.get("/contract/:contractId", authenticateJWT, handler(ReviewController.checkExists));

export default route;
