import { execFile } from "child_process";
import { promisify } from "util";
import { pathToFileURL } from "url";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export async function convertWithLibreOffice(docxPath: string, outDir: string): Promise<string> {
  const binary = process.env.SOFFICE_PATH || "soffice";
  const profileDir = path.join(outDir, "lo-profile");
  fs.mkdirSync(profileDir, { recursive: true });

  await execFileAsync(
    binary,
    [
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      "--headless",
      "--norestore",
      "--nolockcheck",
      "--convert-to",
      "pdf:writer_pdf_Export",
      "--outdir",
      outDir,
      docxPath,
    ],
    { timeout: 120000, env: { ...process.env, HOME: outDir } }
  );

  const pdfPath = path.join(outDir, `${path.parse(docxPath).name}.pdf`);
  if (!fs.existsSync(pdfPath)) {
    throw new Error("LibreOffice did not produce a PDF");
  }
  return pdfPath;
}
