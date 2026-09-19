import "dotenv/config";
import mongoose from "mongoose";
import { DocTemplateService } from "../services/docTemplate.service";

/**
 * Creates the six bundled Tiptap templates (recreated from frontend/docs/*.docx)
 * that do not exist yet. Idempotent: existing templates — and any edits made to
 * them — are never overwritten.
 */
export const seedDocxTemplates = (createdBy?: string) => DocTemplateService.seed(createdBy);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected. Seeding document templates...");
  console.log(JSON.stringify(await seedDocxTemplates(), null, 2));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
