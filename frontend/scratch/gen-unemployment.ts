/* TEMPORARY harness — renders certificateOfUnemployment via the real pipeline. */
import fs from "fs";
import path from "path";

const PUBLIC_ROOT = path.resolve(__dirname, "../public");

import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { buildDynamicDocumentPDF } from "@/app/utils/dynamicDocumentGenerator";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".json": "application/json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
};

(globalThis as any).fetch = async (url: string) => {
  if (typeof url === "string" && (url.startsWith("/assets/") || url.startsWith("/documents/"))) {
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
    externalRecipients: [],
    sms: { enabled: true, senderName: "", provider: "Semaphore", notifyOnRequest: true, notifyOnStatus: true, notifyOnPayment: true },
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

const OUT = "C:/Users/jason/AppData/Local/Temp/opencode/gen-test";

async function main() {
  const store = useBarangaySettingsStore.getState();
  store.setOfficials(buildSampleOfficials() as any);
  store.setSettings(buildSampleSettings() as any);

  const doc: any = {
    document: "certificateOfUnemployment",
    fullName: "JASON GALLANO",
    resident: { name: "JASON GALLANO", gender: "male", civilStatus: "single" },
    dateIssued: "2026-09-10",
    dateOfBirth: "1997-03-15",
    address: "Purok 6, Barangay Rabon, Rosario, La Union",
    purpose: "Employment purposes",
    civilStatus: "Single",
    _id: "doc-test-unemp",
  };

  const { bytes } = await buildDynamicDocumentPDF(doc);
  fs.writeFileSync(path.join(OUT, "generated-unemployment.pdf"), Buffer.from(bytes));
  console.log("WROTE generated-unemployment.pdf", bytes.length, "bytes");
}

main().catch((e) => {
  console.error("HARNESS FAILED", e);
  process.exit(1);
});