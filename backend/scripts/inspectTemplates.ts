import dotenv from "dotenv";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import DocTemplate from "../model/docTemplate.model";

dotenv.config({ path: path.resolve(process.cwd(), "backend", ".env") });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected. Inspecting DocTemplates...\n");

  const templates = await DocTemplate.find({}).lean();
  const docDir = path.resolve(process.cwd(), "..", "frontend", "docs");

  console.log("Template Table Data:\n");
  console.log("DocumentType | Name | SourceType | OriginalExists | Filename | Bytes (DB) | SHA256 (DB) | FileExists (frontend/docs)");
  console.log("------------------------------------------------------------------------------------------------------------------");

  for (const t of templates) {
    const docx = t.originalDocx as any;
    const hasBinary = !!docx && !!docx.data;
    const bytes = hasBinary ? (docx.data as Buffer).length : 0;
    const sha256 = docx ? docx.sha256 : "N/A";
    const filename = docx ? docx.originalFilename : (t as any).originalFilename || "N/A";
    
    const fileExists = filename !== "N/A" && fs.existsSync(path.join(docDir, filename));

    console.log(
      `${t.documentType || "N/A"} | ${t.name} | ${t.sourceType} | ${!!docx} | ${filename} | ${bytes} | ${sha256.substring(0, 8)}... | ${fileExists}`
    );
  }

  await mongoose.disconnect();
}

main().catch(console.error);

