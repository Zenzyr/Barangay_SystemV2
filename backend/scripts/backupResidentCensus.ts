import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import ResidentCensusModel from "../model/residentCensus.model";
import dotenv from "dotenv";

dotenv.config();

const mongodb_uri = process.env.MONGODB_URI || "";

// Backup the ResidentCensus collection to an immutable, timestamped JSON file
// that preserves the ORIGINAL values (including __v / createdAt / updatedAt).
//
// The project's own export convention lives in backend/data/; this writes a
// clearly-named pre-change snapshot so it can never be confused with the
// live collection dump that refresh scripts write.
//
// Usage: npm run backup:census  (ts-node scripts/backupResidentCensus.ts)

const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP_DIR = path.join(__dirname, "..", "data", "census_backups");
const OUT_FILE = path.join(BACKUP_DIR, `residentCensus_backup_pre-standardization_${STAMP}.json`);

async function backupCensus() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set in .env - aborting backup.");
    process.exit(1);
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  await mongoose.connect(mongodb_uri);
  const records = await ResidentCensusModel.find({}).lean();

  const payload = {
    meta: {
      createdAt: new Date().toISOString(),
      collection: "residentcensus",
      source: "Resident Census Data Standardization — Phase 1 pre-change snapshot",
      count: records.length,
    },
    records,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf-8");

  const checksum = crypto
    .createHash("sha256")
    .update(fs.readFileSync(OUT_FILE))
    .digest("hex");
  const sizeBytes = fs.statSync(OUT_FILE).size;

  console.log(`Backup written: ${OUT_FILE}`);
  console.log(`Records:         ${records.length}`);
  console.log(`Size (bytes):    ${sizeBytes}`);
  console.log(`SHA-256:         ${checksum}`);

  // Also mirror to the repository's canonical export location (same contents,
  // original values) so the standard project tooling stays consistent.
  const canonical = path.join(__dirname, "..", "data", "residentCensusExport.json");
  fs.writeFileSync(canonical, JSON.stringify(records, null, 2), "utf-8");
  console.log(`Canonical export refreshed: ${canonical}`);

  await mongoose.disconnect();
}

backupCensus().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});