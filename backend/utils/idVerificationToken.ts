import jwt from "jsonwebtoken";
import crypto from "crypto";

const secret = process.env.JWT_SECRET || "";
const TOKEN_TTL = "30m";
const TOKEN_PURPOSE = "id-verification" as const;

export type IdDocType = "national_id" | "voters_id";

interface IdVerificationTokenPayload {
  purpose: typeof TOKEN_PURPOSE;
  idType: IdDocType;
  imageHash: string;
}

export function hashIdImages(frontBuffer: Buffer, backBuffer: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(frontBuffer)
    .update(backBuffer)
    .digest("hex");
}

export function signIdVerificationToken(
  idType: IdDocType,
  imageHash: string,
): string {
  const payload: IdVerificationTokenPayload = {
    purpose: TOKEN_PURPOSE,
    idType,
    imageHash,
  };
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL });
}

export function verifyIdVerificationToken(
  token: string,
  expected: { idType: string; imageHash: string },
): boolean {
  if (!token) return false;
  try {
    const decoded = jwt.verify(
      token,
      secret,
    ) as Partial<IdVerificationTokenPayload>;
    return (
      decoded?.purpose === TOKEN_PURPOSE &&
      decoded?.idType === expected.idType &&
      decoded?.imageHash === expected.imageHash
    );
  } catch {
    return false;
  }
}
