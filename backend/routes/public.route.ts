import express from "express";
import { PublicStatsController } from "../controller/publicStats.controller";
import { AccountController } from "../controller/accounts.controller";
import { publicAiLimiter } from "../middleware/rateLimit";
import { handler } from "../utils/handler";

const router = express.Router();

router.get("/stats", PublicStatsController.getStats);

// Public/guest chatbot for the landing page. Rate-limited; answers from
// barangay data only (never resident records).
router.post("/ai", publicAiLimiter, handler(AccountController.guestChatBot));

export default router;
