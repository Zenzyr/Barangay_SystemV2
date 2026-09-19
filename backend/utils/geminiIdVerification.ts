import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export type IdDocumentType = "national_id" | "voters_id";

export type IdVerificationFailureReason =
  | "not_id"
  | "type_mismatch"
  | "uncertain_type"
  | "inconsistent"
  | "unreadable"
  | null;

export interface GeminiIdVerificationResult {
  is_id: boolean;
  document_type: "national_id" | "voters_id" | "other" | "unknown";
  matches_selected_type: boolean;
  front_valid: boolean;
  back_valid: boolean;
  front_back_match: boolean;
  readable: boolean;
  passed: boolean;
  reason: string;
  failure_reason: IdVerificationFailureReason;
}

const ID_TYPE_LABELS: Record<IdDocumentType, string> = {
  national_id: "Philippine National ID (PhilSys ID)",
  voters_id: "Philippine Voter's ID (COMELEC)",
};

function skippedResult(reason: string): GeminiIdVerificationResult {
  return {
    is_id: true,
    document_type: "unknown",
    matches_selected_type: true,
    front_valid: true,
    back_valid: true,
    front_back_match: true,
    readable: true,
    passed: true,
    reason,
    failure_reason: null,
  };
}

export async function verifyIdDocumentWithGemini(params: {
  idType: IdDocumentType;
  frontBase64: string;
  frontMimeType: string;
  backBase64: string;
  backMimeType: string;
}): Promise<GeminiIdVerificationResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn(
      "[ID-VERIFY] GEMINI_API_KEY is not configured — skipping AI document check",
    );
    return skippedResult(
      "AI document verification is not configured yet; your ID will be reviewed manually.",
    );
  }

  const modelName = process.env.GEMINI_MODEL as string;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            is_id: { type: SchemaType.BOOLEAN },
            document_type: {
              type: SchemaType.STRING,
              format: "enum",
              enum: ["national_id", "voters_id", "other", "unknown"],
            },
            matches_selected_type: { type: SchemaType.BOOLEAN },
            front_valid: { type: SchemaType.BOOLEAN },
            back_valid: { type: SchemaType.BOOLEAN },
            front_back_match: { type: SchemaType.BOOLEAN },
            readable: { type: SchemaType.BOOLEAN },
            passed: { type: SchemaType.BOOLEAN },
            reason: { type: SchemaType.STRING },
          },
          required: [
            "is_id",
            "document_type",
            "matches_selected_type",
            "front_valid",
            "back_valid",
            "front_back_match",
            "readable",
            "passed",
            "reason",
          ],
        },
      },
    },
    { apiVersion: process.env.GEMINI_API_VERSION || "v1beta" },
  );

  const prompt = `You are a document-type and image-consistency checker for a Philippine barangay (village) resident registration system.

The applicant selected this ID type: ${ID_TYPE_LABELS[params.idType]}.
You are given two photos: the FRONT and the BACK of the ID they uploaded.

This is NOT official government identity verification — you are only checking whether the images plausibly show a real, readable government ID of the stated type, and whether the front and back appear to belong together. Do not attempt to verify authenticity beyond visual/textual consistency.

IMPORTANT: determine document_type from the visual/textual evidence in the images ONLY. Do not let the applicant's selected type bias your answer — if the images clearly show a Philippine National ID but the applicant selected Voter's ID, you must still report document_type as "national_id". A National ID is never a valid Voter's ID and vice versa, even though both are legitimate government IDs.

Assess:
- is_id: do both images appear to show a physical government-issued ID card (not a random photo, screenshot, blank paper, or unrelated document)?
- document_type: your best, independent guess based only on what's visible — "national_id" (Philippine National ID / PhilSys — look for "Philippine Identification Card" / "PhilSys" / a PSA reference number) or "voters_id" (Philippine Voter's ID / COMELEC — look for "Commission on Elections" / "COMELEC" / a voter's precinct number) — or "other" if it is a different document entirely, or "unknown" only if the type is genuinely indeterminable from the images.
- matches_selected_type: does document_type EXACTLY equal the applicant's selected type (${params.idType})? "other" and "unknown" never match.
- front_valid: does the front image look like the front side of that ID type?
- back_valid: does the back image look like the back side of that ID type?
- front_back_match: do the front and back appear to be two sides of the SAME physical document (consistent design/layout/colors), rather than two unrelated images?
- readable: are the images clear/sharp enough that the layout and key fields would be legible to a human reviewer?
- passed: true only if is_id, matches_selected_type, front_valid, back_valid, front_back_match, and readable are ALL true.
- reason: one short sentence explaining your overall assessment, written for the applicant. Do NOT quote or repeat any ID number, birthdate, address, or other personal text visible on the document.

Respond with ONLY the JSON object matching the required schema.`;

  let text: string;
  try {
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: params.frontMimeType,
          data: params.frontBase64,
        },
      },
      {
        inlineData: { mimeType: params.backMimeType, data: params.backBase64 },
      },
    ]);
    text = result.response.text();
  } catch (error) {
    console.error(
      "[ID-VERIFY] Gemini request failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return skippedResult(
      "AI document verification is temporarily unavailable; your ID will be reviewed manually.",
    );
  }

  try {
    const raw = JSON.parse(text) as Partial<GeminiIdVerificationResult>;
    return normalize(raw, params.idType);
  } catch {
    console.error("[ID-VERIFY] Gemini returned malformed/truncated JSON");
    return skippedResult(
      "AI document verification is temporarily unavailable; your ID will be reviewed manually.",
    );
  }
}

function normalize(
  raw: Partial<GeminiIdVerificationResult>,
  idType: IdDocumentType,
): GeminiIdVerificationResult {
  const bool = (v: unknown): boolean => v === true;
  const documentType: GeminiIdVerificationResult["document_type"] =
    raw.document_type === "national_id" ||
    raw.document_type === "voters_id" ||
    raw.document_type === "other"
      ? raw.document_type
      : "unknown";

  const is_id = bool(raw.is_id);
  const matches_selected_type = documentType === idType;
  const front_valid = bool(raw.front_valid);
  const back_valid = bool(raw.back_valid);
  const front_back_match = bool(raw.front_back_match);
  const readable = bool(raw.readable);
  const passed =
    is_id &&
    matches_selected_type &&
    front_valid &&
    back_valid &&
    front_back_match &&
    readable;

  const reasonText =
    typeof raw.reason === "string" ? raw.reason.trim().slice(0, 300) : "";
  const { reason, failure_reason } = deriveReason({
    passed,
    is_id,
    documentType,
    idType,
    readable,
    modelReason: reasonText,
  });

  return {
    is_id,
    document_type: documentType,
    matches_selected_type,
    front_valid,
    back_valid,
    front_back_match,
    readable,
    passed,
    reason,
    failure_reason,
  };
}

const ID_TYPE_SHORT_LABELS: Record<IdDocumentType, string> = {
  national_id: "National ID",
  voters_id: "Voter's ID",
};

function deriveReason(params: {
  passed: boolean;
  is_id: boolean;
  documentType: GeminiIdVerificationResult["document_type"];
  idType: IdDocumentType;
  readable: boolean;
  modelReason: string;
}): { reason: string; failure_reason: IdVerificationFailureReason } {
  if (params.passed) {
    return {
      reason:
        params.modelReason ||
        "The uploaded images appear consistent with the selected ID type.",
      failure_reason: null,
    };
  }

  if (!params.is_id) {
    return {
      reason:
        "This doesn't appear to be a valid ID. Please upload a valid National ID or Voter's ID.",
      failure_reason: "not_id",
    };
  }

  if (params.documentType === "unknown") {
    return {
      reason:
        "We couldn't clearly determine your ID type from these photos. Please upload a clearer image.",
      failure_reason: "uncertain_type",
    };
  }

  if (params.documentType !== params.idType) {
    const detected =
      params.documentType === "other"
        ? "a different kind of document"
        : `a ${ID_TYPE_SHORT_LABELS[params.documentType]}`;
    return {
      reason: `You selected ${ID_TYPE_SHORT_LABELS[params.idType]}, but the uploaded image appears to be ${detected}. Please upload a ${ID_TYPE_SHORT_LABELS[params.idType]}.`,
      failure_reason: "type_mismatch",
    };
  }

  if (!params.readable) {
    return {
      reason:
        "The images aren't clear enough to verify. Please upload sharper, well-lit photos.",
      failure_reason: "unreadable",
    };
  }

  return {
    reason:
      params.modelReason ||
      "The front and back images don't look like a matching pair for this ID type. Please re-upload both sides.",
    failure_reason: "inconsistent",
  };
}
