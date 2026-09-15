/**
 * CLI: creates default Document Templates for the known barangay document
 * types (idempotent — skips types that already have a template).
 *
 *   npm run seed:document-templates
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DocumentTemplateService } from "../services/documentTemplate.service";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected. Seeding document templates...");
  const result = await DocumentTemplateService.seedDefaults();
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});