import express from "express";
import { PublicStatsController } from "../controller/publicStats.controller";

const router = express.Router();

router.get("/stats", PublicStatsController.getStats);

export default router;
