import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

/**
 * Converts a rendered .docx buffer into a PDF using Microsoft Word COM
 * automation (via PowerShell). Word is the only converter
 * available that faithfully reproduces the template layout (headers, anchored
 * logos, the faded watermark) — the same pipeline proven by the manual
 * "Save as PDF" in Word.
 *
 * Conversions are queued because Word COM automates a single shared instance
 * and concurrent requests would race against each other.
 */

let queue: Promise<unknown> = Promise.resolve();

function runWordConversion(docxPath: string, pdfPath: string): Promise<void> {
  const scriptPath = path.join(path.dirname(docxPath), "convert.ps1");
  const script = [
    '$ErrorActionPreference = "Stop"',
    "$word = New-Object -ComObject Word.Application",
    "$word.Visible = $false",
    "$word.DisplayAlerts = 0",
    "try {",
    `  $doc = $word.Documents.Open(${JSON.stringify(docxPath)}, $false, $true)`,
    `  $doc.ExportAsFixedFormat(${JSON.stringify(pdfPath)}, 17)`,
    "  $doc.Close(0)",
    "} finally {",
    "  $word.Quit()",
    "  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null",
    "}",
  ].join("\n");
  fs.writeFileSync(scriptPath, script);

  return execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
    { timeout: 90000, windowsHide: true }
  ).then(() => undefined);
}

async function doConvert(docxBuffer: Buffer): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brgy-docx-pdf-"));
  const docxPath = path.join(tmpDir, "input.docx");
  const pdfPath = path.join(tmpDir, "output.pdf");
  try {
    fs.writeFileSync(docxPath, docxBuffer);
    await runWordConversion(docxPath, pdfPath);
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