// One-time seed script to load default recommendation rules.
//
// Usage:
//   npm run seed:rules
//
// Safe to re-run: it only inserts rules whose problemName doesn't already
// exist, so it won't create duplicates or overwrite rules you've since edited.

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import RecommendationRuleModel from "../model/recommendationRule.model";

dotenv.config();

const mongodb_uri = process.env.MONGODB_URI || "";

async function seed() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set in .env - aborting seed.");
    process.exit(1);
  }

  const seedPath = path.join(__dirname, "..", "data", "recommendationRulesSeed.json");
  const raw = fs.readFileSync(seedPath, "utf-8");
  const rules = JSON.parse(raw);

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongodb_uri);

  let inserted = 0;
  let skipped = 0;

  for (const rule of rules) {
    const exists = await RecommendationRuleModel.findOne({ problemName: rule.problemName });
    if (exists) {
      skipped++;
      continue;
    }
    await RecommendationRuleModel.create(rule);
    inserted++;
  }

  console.log(`Done. Inserted ${inserted} rule(s), skipped ${skipped} already-existing rule(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
