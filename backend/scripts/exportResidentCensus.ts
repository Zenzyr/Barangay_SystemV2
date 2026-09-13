import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import ResidentCensusModel from "../model/residentCensus.model";
import dotenv from "dotenv";

dotenv.config();

const mongodb_uri = process.env.MONGODB_URI || "";

async function exportCensus() {
  await mongoose.connect(mongodb_uri);
  const records = await ResidentCensusModel.find().lean();
  const outPath = path.join(__dirname, "..", "data", "residentCensusExport.json");
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2), "utf-8");
  console.log(`Exported ${records.length} resident census records to ${outPath}`);
  await mongoose.disconnect();
}

exportCensus().catch((err) => {
  console.error(err);
  process.exit(1);
});
