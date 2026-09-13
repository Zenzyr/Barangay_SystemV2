// ID photo verification via OCR.space (free-tier OCR).
// Uses Node's built-in global fetch (Node 18+) rather than the "node-fetch"
// package, since node-fetch v3 is ESM-only and this project compiles to CommonJS.

import "dotenv/config";

const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";

export type IdSide = "front" | "back";

export interface IdVerificationResult {
  ok: boolean;
  side: IdSide;
  skipped?: boolean;
  message?: string;
  matched?: string[];
}

// Keywords that commonly appear on the front of Philippine-issued IDs.
const FRONT_MARKERS = [
  "republic of the philippines",
  "philippines",
  "unified multipurpose",
  "umid",
  "driver",
  "license",
  "licence",
  "philhealth",
  "member",
  "sss",
  "gsis",
  "passport",
  "national id",
  "philsys",
  "philippine identification",
  "filipino citizen",
  "voter",
  "tin",
  "prc",
  "birth",
  "date of birth",
  "birthdate",
  "birthday",
  "sex",
  "signature",
  "address",
  "nationality",
  "given name",
  "surname",
  "privacy",
  "civil status",
];

// Keywords that commonly appear on the back of Philippine-issued IDs.
const BACK_MARKERS = [
  "department of",
  "philippines",
  "national id",
  "address",
  "election",
  "privacy",
  "barcode",
  "bar code",
  "qrcode",
  "qr code",
  "signature",
  "restriction",
  "surname",
  "given name",
  "philhealth",
  "blood type",
];

interface TextStats {
  markers: string[];
  digitRunMax: number;
  letterCount: number;
  wordCount: number;
}

function analyzeText(parsed: string, side: IdSide): TextStats {
  const normalized = parsed.replace(/\s+/g, " ").toLowerCase();
  const markers = (side === "front" ? FRONT_MARKERS : BACK_MARKERS).filter((m) =>
    normalized.includes(m)
  );
  const digitRuns = (normalized.match(/\d+/g) || []).map((d) => d.length);
  const digitRunMax = digitRuns.length ? Math.max(...digitRuns) : 0;
  const letterCount = (parsed.match(/[a-zA-Z]/g) || []).length;
  const wordCount = parsed.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w)).length;
  return { markers, digitRunMax, letterCount, wordCount };
}

// Lenient on purpose: OCR on photos is imperfect, so we only block images that
// clearly do not contain ID-like text.
function looksLikeId(stats: TextStats, side: IdSide): boolean {
  const minText = side === "front" ? 30 : 18;
  if (stats.letterCount < minText) return false;
  if (stats.markers.length > 0) return true;
  return stats.digitRunMax >= 6 && stats.wordCount >= 4;
}

async function callOcrSpace(base64: string): Promise<string> {
  const form = new URLSearchParams();
  form.set("apikey", process.env.OCR_SPACE_API_KEY || "");
  form.set("language", "eng");
  form.set("isOverlayRequired", "false");
  form.set("OCREngine", "2");
  form.set("scale", "true");
  form.set("detectOrientation", "true");
  form.set("base64Image", `data:image/jpeg;base64,${base64}`);

  const response = await fetch(OCR_SPACE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!response.ok) {
    throw new Error(`OCR service responded with status ${response.status}`);
  }

  const json = (await response.json()) as {
    OCRExitCode?: number;
    ErrorMessage?: string;
    ParsedResults?: {
      ParsedText?: string;
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string;
    }[];
  };

  if (json.OCRExitCode !== 1 || !json.ParsedResults?.length) {
    throw new Error(json.ErrorMessage || "OCR service could not read the image");
  }

  const [result] = json.ParsedResults;
  if (result.IsErroredOnProcessing) {
    throw new Error(result.ErrorMessage || "OCR engine error");
  }

  return result.ParsedText || "";
}

export async function verifyIdWithOcr(
  base64OrDataUrl: string,
  side: IdSide
): Promise<IdVerificationResult> {
  let base64 = base64OrDataUrl;
  if (base64.startsWith("data:")) {
    const comma = base64.indexOf(",");
    if (comma !== -1) base64 = base64.slice(comma + 1);
  }

  const apikey = process.env.OCR_SPACE_API_KEY;
  if (!apikey) {
    return { ok: true, side, skipped: true, message: "ID verification is not configured yet." };
  }

  let text: string;
  try {
    text = await callOcrSpace(base64);
  } catch (error) {
    return {
      ok: false,
      side,
      message: error instanceof Error ? error.message : "OCR service is unavailable",
    };
  }

  const stats = analyzeText(text, side);
  const ok = looksLikeId(stats, side);
  const message = ok
    ? "ID text found."
    : side === "back"
      ? "This does not look like the back of an ID — upload a clear photo of the back of your ID."
      : "This does not look like the front of an ID — upload a clear photo of the front of your ID.";
  return { ok, side, message, matched: stats.markers };
}