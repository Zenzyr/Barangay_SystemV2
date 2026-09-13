/* TEMPORARY generation harness — reproduces the real document pipeline in Node. */
import fs from "fs";
import path from "path";

const PUBLIC_ROOT = path.resolve(__dirname, "../public");

import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { buildDynamicDocumentPDF } from "@/app/utils/dynamicDocumentGenerator";
import {
  getDocxTemplateSpec,
  buildDocumentData,
  renderDocxTemplate,
} from "@/app/utils/docxTemplateEngine";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".json": "application/json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ttf": "font/ttf",
};

(globalThis as any).fetch = async (url: string) => {
  if (typeof url === "string" && url.startsWith("/assets/")) {
    const abs = path.join(PUBLIC_ROOT, url.replace(/^\/+/, ""));
    if (!fs.existsSync(abs)) {
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    const buf = fs.readFileSync(abs);
    const ctor = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
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
      { label: "Mayor", name: "Hon. Bellarmin A. Flores II", position: "Mayor" },
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
      fullName: "HON. EDUARDO G. BALANON",
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

const OUT = "C:/Users/jason/AppData/Local/Temp/opencode/gen-test";

async function main() {
  const store = useBarangaySettingsStore.getState();
  store.setOfficials(buildSampleOfficials() as any);
  store.setSettings(buildSampleSettings() as any);

  const doc: any = sampleCOI();

  // 1) Dynamic pdf-lib PDF (the "Document" download path)
  const { bytes: pdfBytes } = await buildDynamicDocumentPDF(doc);
  fs.writeFileSync(path.join(OUT, "dynamic-coi.pdf"), Buffer.from(pdfBytes));

  // 2) docxtemplater DOCX (the DOCX download path)
  const spec = await getDocxTemplateSpec(doc.document);
  const data = buildDocumentData(
    doc,
    store.settings as any,
    store.activeByPosition(),
    store.activeOfficialsByPosition()
  );
  const docxBytes = await renderDocxTemplate(spec!, data);
  fs.writeFileSync(path.join(OUT, "generated-coi.docx"), Buffer.from(docxBytes));

  console.log("WROTE OK");
  console.log("pdf size:", pdfBytes.length, "docx size:", docxBytes.length);
}

main().catch((e) => {
  console.error("HARNESS FAILED", e);
  process.exit(1);
});