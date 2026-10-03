import fs from "fs";
import os from "os";
import path from "path";
import { convertWithWord } from "./docxConverters/wordConverter";
import { convertWithLibreOffice } from "./docxConverters/libreOfficeConverter";

export type DocxConverterEngine = "word" | "libreoffice";

export function resolveDocxConverter(
  setting: string | undefined = process.env.DOCX_PDF_CONVERTER,
  platform: NodeJS.Platform = process.platform,
): DocxConverterEngine {
  const value = (setting || "auto").trim().toLowerCase();
  if (value === "word" || value === "libreoffice") return value;
  return platform === "win32" ? "word" : "libreoffice";
}

let queue: Promise<unknown> = Promise.resolve();

async function doConvert(docxBuffer: Buffer): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brgy-docx-pdf-"));
  const docxPath = path.join(tmpDir, "input.docx");
  try {
    fs.writeFileSync(docxPath, docxBuffer);
    const engine = resolveDocxConverter();
    const pdfPath =
      engine === "word"
        ? await convertWithWord(docxPath, tmpDir)
        : await convertWithLibreOffice(docxPath, tmpDir);
    return fs.readFileSync(pdfPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const conversion = queue.then(() => doConvert(docxBuffer));
  queue = conversion.catch(() => undefined);
  return conversion;
}
