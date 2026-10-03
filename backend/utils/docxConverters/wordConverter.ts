import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export async function convertWithWord(docxPath: string, outDir: string): Promise<string> {
  const pdfPath = path.join(outDir, "output.pdf");
  const scriptPath = path.join(outDir, "convert.ps1");
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

  await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
    { timeout: 90000, windowsHide: true }
  );
  return pdfPath;
}
