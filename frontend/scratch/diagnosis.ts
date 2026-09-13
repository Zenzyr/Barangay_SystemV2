/* MANDATORY DOCX PIPELINE DIAGNOSIS
 * Test A: Original DOCX copied unmodified
 * Test B-G: Incremental replacements
 *
 * For each test:
 *   1. Build DOCX bytes
 *   2. Save to disk
 *   3. Convert to PDF via Word COM
 *   4. Compare structure (file size, ZIP contents, XML diffs)
 */

import fs from "fs";
import path from "path";

const PUBLIC_ROOT = path.resolve(__dirname, "../public");
const OUT = "C:/Users/jason/AppData/Local/Temp/opencode/gen-test";

import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import {
  getDocxTemplateSpec,
  buildDocumentData,
  renderDocxTemplate,
  isDocxTemplated,
} from "@/app/utils/docxTemplateEngine";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ttf": "font/ttf",
};

(globalThis as any).fetch = async (url: string) => {
  if (typeof url === "string" && url.startsWith("/assets/")) {
    const abs = path.join(PUBLIC_ROOT, url.replace(/^\/+/, ""));
    if (!fs.existsSync(abs)) {
      return {
        ok: false,
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }
    const buf = fs.readFileSync(abs);
    const ctor =
      MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
    return {
      ok: true,
      status: 200,
      url,
      headers: { get: () => ctor },
      arrayBuffer: async () =>
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      json: async () => JSON.parse(buf.toString("utf8")),
      text: async () => buf.toString("utf8"),
    };
  }
  throw new Error("fetch not stubbed for: " + url);
};

function buildSampleSettings() {
  return {
    _id: "test-settings",
    barangay: {
      name: "Barangay Rabon",
      municipality: "Rosario",
      province: "La Union",
      region: "Ilocos Region",
      address: "",
      contactNumber: "",
      email: "",
      logoUrl: "/assets/logo.jpg",
      sealUrl: "",
      headerText: "",
      footerText: "",
    },
    documents: {
      headerText: "",
      footerText: "",
      logoUrl: "/assets/logo.jpg",
      backgroundUrl: "",
      watermarkText: "",
      sealUrl: "",
      certificateNumberFormat: "",
      signatoryTitle: "Punong Barangay",
      signaturePositions: [],
      marginLeft: 60,
      marginRight: 60,
      marginTop: 60,
      marginBottom: 60,
      overlays: {},
    },
    externalRecipients: [
      {
        label: "Mayor",
        name: "Hon. Bellarmin A. Flores II",
        position: "Mayor",
      },
    ],
    sms: {
      enabled: true,
      senderName: "",
      provider: "Semaphore",
      notifyOnRequest: true,
      notifyOnStatus: true,
      notifyOnPayment: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildSampleOfficials() {
  const base = {
    status: "active" as const,
    termStart: "",
    termEnd: "",
    termLabel: "",
    signatureImage: "",
    photo: "",
    contact: "",
    notes: "",
  };
  return [
    {
      ...base,
      _id: "pb",
      fullName: "EDUARDO G. BALANON",
      position: "Punong Barangay",
      precedence: 1,
    },
    {
      ...base,
      _id: "sec",
      fullName: "ANGELINA Y. MARQUEZ",
      position: "Barangay Secretary",
      precedence: 2,
    },
  ];
}

function sampleEndorsement() {
  return {
    document: "endorsementLetter",
    fullName: "Jason Gallano",
    resident: { name: "Jason Gallano", gender: "male", civilStatus: "single" },
    dateIssued: "2026-09-10",
    assistanceTo: "Jason Gallano",
    civilStatus: "Single",
    annualIncome: "6000",
    address: "Purok 3, Barangay Rabon",
    age: "29",
    purpose: "Educational Scholarship",
    _id: "doc-test-el",
  };
}

function sampleCOI() {
  return {
    document: "certificateOfIndigency",
    fullName: "Jason Gallano",
    resident: { name: "Jason Gallano", gender: "male", civilStatus: "single" },
    dateIssued: "2026-09-10",
    assistanceTo: "Jason Gallano",
    civilStatus: "Single",
    annualIncome: "6000",
    address: "Purok 3, Barangay Rabon",
    age: "29",
    purpose: "Financial Assistance",
    _id: "doc-test-coi",
  };
}

function listZipContents(zipBytes: Uint8Array): string[] {
  // Simple PK header scan for filenames
  // Use a lightweight approach: just report file count and key files
  const str = Buffer.from(zipBytes).toString("latin1");
  const files: string[] = [];
  // Find all local file headers (PK\x03\x04)
  let pos = 0;
  while (pos < str.length - 30) {
    if (
      str.charCodeAt(pos) === 0x50 &&
      str.charCodeAt(pos + 1) === 0x4b &&
      str.charCodeAt(pos + 2) === 0x03 &&
      str.charCodeAt(pos + 3) === 0x04
    ) {
      const fnameLen = str.charCodeAt(pos + 26) | (str.charCodeAt(pos + 27) << 8);
      const fname = str.substring(pos + 30, pos + 30 + fnameLen);
      files.push(fname);
      const extraLen = str.charCodeAt(pos + 28) | (str.charCodeAt(pos + 29) << 8);
      pos += 30 + fnameLen + extraLen;
    } else {
      pos++;
    }
  }
  return files;
}

function extractXmlSnippet(xml: string, tag: string): string {
  const idx = xml.indexOf(tag);
  if (idx === -1) return `[${tag} NOT FOUND]`;
  return xml.substring(Math.max(0, idx - 20), Math.min(xml.length, idx + tag.length + 80));
}

async function testA_NoModifications(templateFile: string, testName: string) {
  console.log(`\n=== TEST A: ${testName} — No modifications ===`);

  // Step 1: Read original template bytes
  const absTemplate = path.join(PUBLIC_ROOT, templateFile);
  if (!fs.existsSync(absTemplate)) {
    console.log(`  SKIP: Template file not found: ${templateFile}`);
    return;
  }
  const origBytes = fs.readFileSync(absTemplate);
  const origSize = origBytes.length;
  console.log(`  Original file size: ${origSize} bytes`);

  // Step 2: Save copy
  const outPath = path.join(OUT, `testA-${testName}.docx`);
  fs.writeFileSync(outPath, origBytes);
  console.log(`  Saved copy: ${outPath}`);

  // Step 3: Inspect ZIP contents
  const files = listZipContents(new Uint8Array(origBytes));
  const headerFiles = files.filter((f) => f.startsWith("word/header"));
  const mediaFiles = files.filter((f) => f.startsWith("word/media"));
  const relsFiles = files.filter((f) => f.includes("_rels") && f.endsWith(".rels"));
  console.log(`  ZIP files: ${files.length} total`);
  console.log(`  Headers: ${headerFiles.join(", ")}`);
  console.log(`  Media: ${mediaFiles.join(", ")}`);
  console.log(`  Rels: ${relsFiles.length} rels files`);

  // Step 4: Extract key XML snippets from document.xml and header2.xml
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(origBytes);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (docXml) {
    const hasDrawing = docXml.includes("w:drawing");
    const hasAnchor = docXml.includes("wp:anchor");
    const hasInline = docXml.includes("wp:inline");
    const hasPict = docXml.includes("w:pict");
    const hasPlaceholder = docXml.includes("{{");
    console.log(`  document.xml: drawing=${hasDrawing} anchor=${hasAnchor} inline=${hasInline} pict=${hasPict} placeholders=${hasPlaceholder}`);
  }

  const hdr2 = await zip.file("word/header2.xml")?.async("string");
  if (hdr2) {
    const anchorCount = (hdr2.match(/wp:anchor/g) || []).length;
    const pictCount = (hdr2.match(/w:pict/g) || []).length;
    const imgDataCount = (hdr2.match(/v:imagedata/g) || []).length;
    const blipCount = (hdr2.match(/a:blip/g) || []).length;
    console.log(`  header2.xml: anchors=${anchorCount} pict=${pictCount} imagedata=${imgDataCount} blips=${blipCount}`);
  }

  // Step 5: Verify checksum matches original
  const copyBytes = fs.readFileSync(outPath);
  const match = Buffer.compare(origBytes, copyBytes) === 0;
  console.log(`  Byte-for-byte match: ${match ? "PASS" : "FAIL"}`);

  // Step 6: Convert to PDF via Word COM
  const pdfPath = path.join(OUT, `testA-${testName}.pdf`);
  try {
    const { execSync } = await import("child_process");
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\jason\\AppData\\Local\\Temp\\opencode\\word2pdf.ps1" "${outPath}" "${pdfPath}"`,
      { timeout: 60000 }
    );
    const pdfSize = fs.statSync(pdfPath).size;
    console.log(`  PDF conversion: PASS (${pdfSize} bytes)`);
  } catch (e: any) {
    console.log(`  PDF conversion: FAIL — ${e.message?.slice(0, 200)}`);
  }

  console.log(`  RESULT: ${match ? "PASS" : "FAIL"}`);
}

async function testB_WithReplacements(
  docType: string,
  doc: any,
  testName: string
) {
  console.log(`\n=== TEST B-G: ${testName} — With text replacements ===`);

  const store = useBarangaySettingsStore.getState();
  store.setOfficials(buildSampleOfficials() as any);
  store.setSettings(buildSampleSettings() as any);

  const spec = await getDocxTemplateSpec(docType);
  if (!spec) {
    console.log(`  SKIP: No template spec for ${docType}`);
    return;
  }
  console.log(`  Template file: ${spec.templateFile}`);

  // Build data
  const data = buildDocumentData(
    doc,
    store.settings as any,
    store.activeByPosition(),
    store.activeOfficialsByPosition()
  );

  // Show what we're replacing
  const flatData = JSON.stringify(data, null, 0).slice(0, 500);
  console.log(`  Data keys: ${Object.keys(data).join(", ")}`);
  console.log(`  Officials punongBarangay: "${(data as any).officials?.punongBarangay}"`);
  console.log(`  Barangay punongBarangay: "${(data as any).barangay?.punongBarangay}"`);

  // Render
  const docxBytes = await renderDocxTemplate(spec, data);
  console.log(`  Generated DOCX size: ${docxBytes.length} bytes`);

  // Save
  const outPath = path.join(OUT, `testB-${testName}.docx`);
  fs.writeFileSync(outPath, Buffer.from(docxBytes));
  console.log(`  Saved: ${outPath}`);

  // Inspect generated DOCX structure
  const zip = await import("jszip").then((m) => m.default.loadAsync(docxBytes));
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (docXml) {
    const hasDrawing = docXml.includes("w:drawing");
    const hasAnchor = docXml.includes("wp:anchor");
    const hasPict = docXml.includes("w:pict");
    const hasPlaceholder = docXml.includes("{{");
    console.log(`  Generated document.xml: drawing=${hasDrawing} anchor=${hasAnchor} pict=${hasPict} placeholders_remaining=${hasPlaceholder}`);

    // Check if placeholders were replaced
    const remaining = (docXml.match(/\{\{[^}]+\}\}/g) || []);
    if (remaining.length > 0) {
      console.log(`  WARNING: Unreplaced placeholders: ${remaining.join(", ")}`);
    }
  }

  const hdr2 = await zip.file("word/header2.xml")?.async("string");
  if (hdr2) {
    const anchorCount = (hdr2.match(/wp:anchor/g) || []).length;
    const pictCount = (hdr2.match(/w:pict/g) || []).length;
    const blipCount = (hdr2.match(/a:blip/g) || []).length;
    console.log(`  Generated header2.xml: anchors=${anchorCount} pict=${pictCount} blips=${blipCount}`);
  }

  // Compare with original template
  const origBytes = fs.readFileSync(path.join(PUBLIC_ROOT, spec.templateFile));
  const origZip = await import("jszip").then((m) => m.default.loadAsync(origBytes));
  const origHdr2 = await origZip.file("word/header2.xml")?.async("string");
  if (origHdr2 && hdr2) {
    const headersMatch = origHdr2 === hdr2;
    console.log(`  header2.xml preserved: ${headersMatch ? "PASS" : "FAIL"}`);
    if (!headersMatch) {
      // Find first difference
      for (let i = 0; i < Math.max(origHdr2.length, hdr2.length); i++) {
        if (origHdr2[i] !== hdr2[i]) {
          console.log(`  First diff at char ${i}:`);
          console.log(`    Original: ...${origHdr2.slice(Math.max(0, i - 40), i + 60)}...`);
          console.log(`    Generated: ...${hdr2.slice(Math.max(0, i - 40), i + 60)}...`);
          break;
        }
      }
    }
  }

  // Check all header files
  for (const h of ["word/header1.xml", "word/header3.xml"]) {
    const origH = await origZip.file(h)?.async("string");
    const genH = await zip.file(h)?.async("string");
    if (origH && genH) {
      console.log(`  ${h} preserved: ${origH === genH ? "PASS" : "FAIL"}`);
    }
  }

  // Check media files
  const origMedia: Record<string, number> = {};
  const genMedia: Record<string, number> = {};
  origZip.forEach((p, e) => {
    if (p.startsWith("word/media/")) origMedia[p] = e._data.length;
  });
  zip.forEach((p, e) => {
    if (p.startsWith("word/media/")) genMedia[p] = e._data.length;
  });
  console.log(`  Original media files: ${Object.keys(origMedia).join(", ")}`);
  console.log(`  Generated media files: ${Object.keys(genMedia).join(", ")}`);
  for (const [f, origLen] of Object.entries(origMedia)) {
    const genLen = genMedia[f];
    if (genLen === undefined) {
      console.log(`  ${f}: MISSING in generated`);
    } else if (origLen !== genLen) {
      console.log(`  ${f}: SIZE MISMATCH orig=${origLen} gen=${genLen}`);
    }
  }

  // Convert to PDF
  const pdfPath = path.join(OUT, `testB-${testName}.pdf`);
  try {
    const { execSync } = await import("child_process");
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\jason\\AppData\\Local\\Temp\\opencode\\word2pdf.ps1" "${outPath}" "${pdfPath}"`,
      { timeout: 60000 }
    );
    const pdfSize = fs.statSync(pdfPath).size;
    console.log(`  PDF conversion: PASS (${pdfSize} bytes)`);

    // Also convert original for comparison
    const origPdfPath = path.join(OUT, `testA-${testName}.pdf`);
    if (fs.existsSync(origPdfPath)) {
      const origPdfSize = fs.statSync(origPdfPath).size;
      console.log(`  Original PDF size: ${origPdfSize} bytes`);
      console.log(`  Generated PDF size: ${pdfSize} bytes`);
      const ratio = (pdfSize / origPdfSize * 100).toFixed(1);
      console.log(`  Size ratio: ${ratio}%`);
    }
  } catch (e: any) {
    console.log(`  PDF conversion: FAIL — ${e.message?.slice(0, 200)}`);
  }
}

async function main() {
  const store = useBarangaySettingsStore.getState();
  store.setOfficials(buildSampleOfficials() as any);
  store.setSettings(buildSampleSettings() as any);

  console.log("DOCUMENT PIPELINE DIAGNOSIS");
  console.log("===========================");

  // ═══════════════════════════════════════════════════
  // TEST A: Original DOCX unmodified (Endorsement Letter)
  // ═══════════════════════════════════════════════════
  await testA_NoModifications(
    "/assets/document-template/endorsement-letter-template.docx",
    "endorsement-letter"
  );

  // ═══════════════════════════════════════════════════
  // TEST A2: Original DOCX unmodified (COI)
  // ═══════════════════════════════════════════════════
  await testA_NoModifications(
    "/assets/document-template/certificate-of-indigency-template.docx",
    "certificate-of-indigency"
  );

  // ═══════════════════════════════════════════════════
  // TEST B-G: With replacements (Endorsement Letter)
  // ═══════════════════════════════════════════════════
  const elDoc = sampleEndorsement();
  await testB_WithReplacements("endorsementLetter", elDoc, "endorsement-letter");

  // ═══════════════════════════════════════════════════
  // TEST B-G: With replacements (COI)
  // ═══════════════════════════════════════════════════
  const coiDoc = sampleCOI();
  await testB_WithReplacements("certificateOfIndigency", coiDoc, "certificate-of-indigency");

  console.log("\n===========================");
  console.log("DIAGNOSIS COMPLETE");
}

main().catch((e) => {
  console.error("TEST FAILED", e);
  process.exit(1);
});
