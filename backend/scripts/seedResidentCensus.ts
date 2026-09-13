// One-time seed script to import resident census data (e.g. from RESIDENT-INFORMATION.xlsx)
// into the ResidentCensus collection.
//
// Usage:
//   npm run seed:census
//
// Safe to re-run: it clears the ResidentCensus collection before inserting,
// so running it twice won't create duplicates.

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import ResidentCensusModel from "../model/residentCensus.model";

dotenv.config();

const mongodb_uri = process.env.MONGODB_URI || "";

async function seed() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set in .env - aborting seed.");
    process.exit(1);
  }

  const seedPath = path.join(__dirname, "..", "data", "residentCensusSeed.json");
  const raw = fs.readFileSync(seedPath, "utf-8");
  const records = JSON.parse(raw);

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongodb_uri);

  console.log(`Clearing existing ResidentCensus records...`);
  await ResidentCensusModel.deleteMany({});

  console.log(`Inserting ${records.length} resident census records...`);
  await ResidentCensusModel.insertMany(records);

  console.log("Done. Resident census data has been seeded.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
