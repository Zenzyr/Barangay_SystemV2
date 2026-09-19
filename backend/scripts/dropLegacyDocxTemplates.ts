import "dotenv/config";
import mongoose from "mongoose";

/**
 * One-off cleanup after the move to Tiptap templates: drops the legacy
 * `docxtemplates` collection (binary .docx records used by the previous,
 * file-based editor). The originals remain in frontend/docs/. Safe to re-run.
 *
 *   npx ts-node scripts/dropLegacyDocxTemplates.ts          # dry run
 *   npx ts-node scripts/dropLegacyDocxTemplates.ts --apply  # drop it
 */
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const exists = (await db.listCollections({ name: "docxtemplates" }).toArray()).length > 0;
  if (!exists) {
    console.log("No legacy docxtemplates collection found. Nothing to do.");
  } else {
    const count = await db.collection("docxtemplates").countDocuments();
    if (!apply) {
      console.log(`Would drop legacy "docxtemplates" (${count} records). Re-run with --apply.`);
    } else {
      await db.collection("docxtemplates").drop();
      console.log(`Dropped legacy "docxtemplates" (${count} records).`);
    }
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
