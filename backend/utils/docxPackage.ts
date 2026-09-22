// Dependency-free helpers for working with DOCX (OOXML/ZIP) packages in the
// template pipeline. They only ever read the ZIP container — never the content
// — so the same code can validate an upload and, later, locate the OOXML parts
// for placeholder replacement without pulling a zip library into production.

import crypto from "crypto";

/** Hexadecimal SHA-256 of a buffer (used to fingerprint the original DOCX). */
export function sha256Hex(input: Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const EOCD_SIG = 0x06054b50; // PK\x05\x06 (End of Central Directory)
const CDH_SIG = 0x02014b50; // PK\x01\x02 (Central Directory File Header)
const ZIP64_EOCD_SIG = 0x06064b50; // PK\x06\x06
const ZIP64_LOCATOR_SIG = 0x07064b50; // PK\x06\x07

function searchLastSignature(buf: Buffer, target: number, maxScan: number): number {
  const start = Math.max(0, buf.length - maxScan);
  for (let i = buf.length - 4; i >= start; i--) {
    if (buf.readUInt32LE(i) === target) return i;
  }
  return -1;
}

/**
 * Names of the entries inside a ZIP package, read from the central directory.
 * Supports plain and zip64 archives. Returns [] when the buffer is not a
 * readable ZIP container.
 */
export function listZipEntries(buf: Buffer): string[] {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return [];

  const eocd = searchLastSignature(buf, EOCD_SIG, 65557);
  if (eocd < 0) return [];

  let total = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  if (total === 0xffff || cdOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (
      locator >= 0 &&
      buf.readUInt32LE(locator) === ZIP64_LOCATOR_SIG
    ) {
      const rec = Number(buf.readBigUInt64LE(locator + 8));
      if (
        Number.isSafeInteger(rec) &&
        rec >= 0 &&
        rec + 56 <= buf.length &&
        buf.readUInt32LE(rec) === ZIP64_EOCD_SIG
      ) {
        total = Number(buf.readBigUInt64LE(rec + 32));
        cdOffset = Number(buf.readBigUInt64LE(rec + 48));
      }
    }
  }

  const names: string[] = [];
  let p = cdOffset;
  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.length) break;
    if (buf.readUInt32LE(p) !== CDH_SIG) break;
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const nameStart = p + 46;
    if (nameStart + nameLen > buf.length) break;
    names.push(buf.toString("utf8", nameStart, nameStart + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

/**
 * Whether a buffer is plausibly a DOCX: it must start like a ZIP container
 * and contain the two mandatory OOXML parts.
 */
export function isDocxPackage(buf: Buffer): boolean {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  const sig = buf.readUInt32LE(0);
  const looksLikeZip =
    sig === 0x04034b50 || // local file header PK\x03\x04
    sig === 0x06054b50 || // empty archive PK\x05\x06
    sig === 0x07084b50; // spanned archive PK\x07\x08
  if (!looksLikeZip) return false;
  const entries = listZipEntries(buf);
  return entries.includes("[Content_Types].xml") && entries.includes("word/document.xml");
}