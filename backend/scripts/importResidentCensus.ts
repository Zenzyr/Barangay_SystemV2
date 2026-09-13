import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import ResidentCensusModel from "../model/residentCensus.model";

dotenv.config();

const mongodb_uri = process.env.MONGODB_URI || "";

async function importCensus() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set in .env - aborting import.");
    process.exit(1);
  }

  const exportPath = path.join(__dirname, "..", "data", "residentCensusExport.json");
  if (!fs.existsSync(exportPath)) {
    console.error(`Export file not found: ${exportPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(exportPath, "utf-8");
  const records = JSON.parse(raw);

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongodb_uri);

  console.log(`Clearing existing ResidentCensus records...`);
  await ResidentCensusModel.deleteMany({});

  console.log(`Inserting ${records.length} resident census records...`);
  await ResidentCensusModel.insertMany(records);

  console.log("Done. Resident census data has been restored.");
  await mongoose.disconnect();
  process.exit(0);
}

importCensus().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});