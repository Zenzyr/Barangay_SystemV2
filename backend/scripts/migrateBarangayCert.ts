import dotenv from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import crypto from "crypto";
import DocTemplate from "../model/docTemplate.model";

dotenv.config({ path: path.resolve(process.cwd(), "backend", ".env") });

function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.\n");

  const documentType = "barangayCertification";
  const originalFilename = "certification-101.docx";
  const docDir = path.resolve(__dirname, "..", "..", "frontend", "docs");
  const filePath = path.join(docDir, originalFilename);

  // 1. Verify Template Existence
  const template = await DocTemplate.findOne({ documentType });
  if (!template) {
    console.error(`Template not found for documentType: ${documentType}`);
    process.exit(1);
  }

  console.log("--- Template Info ---");
  console.log(`ID: ${template._id}`);
  console.log(`DocumentType: ${template.documentType}`);
  console.log(`Current sourceType: ${template.sourceType}`);
  console.log(`OriginalFilename (DB): ${template.originalFilename}`);
  console.log(`OriginalDocx exists: ${!!template.originalDocx}`);

  // 2. Load Original DOCX
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const buffer = fs.readFileSync(filePath);
  const sha256 = sha256Hex(buffer);

  console.log(`\nOriginal file found: ${originalFilename}`);
  console.log(`Byte length: ${buffer.length}`);
  console.log(`SHA-256: ${sha256}`);

  // 3. Update Record
  template.sourceType = "original-docx";
  template.originalDocx = {
    storage: "database",
    originalFilename: originalFilename,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: buffer.length,
    sha256: sha256,
    data: buffer,
    uploadedAt: new Date(),
  } as any;

  await template.save();
  console.log("\n--- Database Updated Successfully ---");
  console.log("SourceType: original-docx");
  console.log("originalDocx populated.");

  // 4. Verify Database Record After Update
  const updated = await DocTemplate.findById(template._id);
  console.log("\n--- Verification ---");
  console.log(`sourceType: ${updated?.sourceType}`);
  console.log(`originalDocx exists: ${!!updated?.originalDocx}`);
  console.log(`Stored size: ${updated?.originalDocx?.size}`);
  console.log(`Stored SHA-256: ${updated?.originalDocx?.sha256}`);

  if (updated?.sourceType === "original-docx" && updated.originalDocx?.size === buffer.length && updated.originalDocx?.sha256 === sha256) {
    console.log("\nSUCCESS: Verification Passed.");
  } else {
    console.error("\nFAILURE: Verification Failed.");
  }

  await mongoose.disconnect();
}

main().catch(console.error);
