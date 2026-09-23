// Dependency-free helpers for working with DOCX (OOXML/ZIP) packages in the
// template pipeline. They only ever read the ZIP container — never the content
// — so the same code can validate an upload and, later, locate the OOXML parts
// for placeholder replacement without pulling a zip library into production.

import crypto from "crypto";
import zlib from "zlib";

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

/** One central-directory record, decoded far enough to locate the entry's bytes. */
interface CdEntry {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  nameBytes: Buffer;
  extraBytes: Buffer;
  commentBytes: Buffer;
  localHeaderOffset: number;
  /** Absolute offset of this CD record inside the archive. */
  recordStart: number;
}

/** Parsed ZIP skeleton: central-directory records plus the CD region bounds. */
interface ZipIndex {
  entries: CdEntry[];
  cdOffset: number;
  cdSize: number;
}

/**
 * Decodes the central directory. Returns null when the buffer is not a
 * readable ZIP archive. Plain records only; per-entry Zip64 extra fields
 * (sizes of 0xffffffff) are not followed — the small DOCX packages this
 * pipeline handles never need them.
 */
function readCentralDirectory(buf: Buffer): ZipIndex | null {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return null;

  const eocd = searchLastSignature(buf, EOCD_SIG, 65557);
  if (eocd < 0) return null;

  let total = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  let cdSize = buf.readUInt32LE(eocd + 12);

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
        cdSize = Number(buf.readBigUInt64LE(rec + 40));
        cdOffset = Number(buf.readBigUInt64LE(rec + 48));
      }
    }
  }

  const entries: CdEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.length) return null;
    if (buf.readUInt32LE(p) !== CDH_SIG) return null;
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const nameStart = p + 46;
    if (nameStart + nameLen > buf.length) return null;

    const name = buf.toString("utf8", nameStart, nameStart + nameLen).replace(/\0/g, "");
    const nameBytes = Buffer.from(buf.slice(nameStart, nameStart + nameLen));
    const extraStart = nameStart + nameLen;
    const extraBytes = Buffer.from(buf.slice(extraStart, extraStart + extraLen));
    const commentStart = extraStart + extraLen;
    const commentBytes = Buffer.from(buf.slice(commentStart, commentStart + commentLen));

    entries.push({
      name,
      method: buf.readUInt16LE(p + 10),
      flags: buf.readUInt16LE(p + 8),
      crc: buf.readUInt32LE(p + 16),
      compressedSize: buf.readUInt32LE(p + 20),
      uncompressedSize: buf.readUInt32LE(p + 24),
      nameBytes,
      extraBytes,
      commentBytes,
      localHeaderOffset: buf.readUInt32LE(p + 42),
      recordStart: p,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries, cdOffset, cdSize };
}

/**
 * Names of the entries inside a ZIP package, read from the central directory.
 * Supports plain and zip64 archives. Returns [] when the buffer is not a
 * readable ZIP container.
 */
export function listZipEntries(buf: Buffer): string[] {
  const index = readCentralDirectory(buf);
  if (!index) return [];
  return index.entries.map((e) => e.name);
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

/**
 * Coerces a stored original package back into a plain Buffer. Mongoose hands a
 * lean-read BinData back as the BSON `Binary` wrapper (not a Buffer); a doc
 * read already returns a Buffer. Accepting both shapes keeps the retrieval
 * path independent of how the document was loaded.
 */
export function toOriginalDocxBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (
    value &&
    typeof (value as { _bsontype?: unknown })._bsontype === "string" &&
    (value as { _bsontype?: string })._bsontype === "Binary"
  ) {
    const raw = (value as { value?: () => unknown }).value?.();
    if (Buffer.isBuffer(raw)) return raw;
  }
  return null;
}

/** The uncompressed bytes of one stored entry, or null when it is missing/unsupported. */
export function readZipEntry(buf: Buffer, entryName: string): Buffer | null {
  const index = readCentralDirectory(buf);
  const entry = index?.entries.find((e) => e.name === entryName);
  if (!entry) return null;

  const localStart = entry.localHeaderOffset;
  if (localStart + 30 > buf.length || buf.readUInt32LE(localStart) !== 0x04034b50) return null;
  const nameLen = buf.readUInt16LE(localStart + 26);
  const extraLen = buf.readUInt16LE(localStart + 28);
  const dataStart = localStart + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buf.length) return null;
  const raw = buf.slice(dataStart, dataEnd);

  if (entry.method === 8) {
    try {
      const inflated = zlib.inflateRawSync(raw);
      if (inflated.length !== entry.uncompressedSize) return null;
      return inflated;
    } catch {
      return null;
    }
  }
  if (entry.method === 0) return Buffer.from(raw);
  return null; // encrypted or exotic compression methods are unsupported
}

/** Standard CRC-32 (IEEE 802.3), needed to fingerprint rewritten entries. */
export function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Returns a new ZIP archive with a single entry's content replaced while every
 * other entry's bytes are preserved verbatim. The entry is re-stored using
 * DEFLATE; its local block and central-directory record are rebuilt and the
 * offsets of everything that follows are patched. Returns null when the
 * package, the entry, or the required offset arithmetic is unsupported.
 */
export function replaceZipEntry(buf: Buffer, entryName: string, newContent: Buffer): Buffer | null {
  const index = readCentralDirectory(buf);
  if (!index) return null;
  const entries = index.entries;
  const target = entries.find((e) => e.name === entryName);
  if (!target) return null;

  // Everything below assumes a plain (non-Zip64) archive layout.
  if (entries.length >= 0xffff || index.cdOffset >= 0xffffffff) return null;

  const localStart = target.localHeaderOffset;
  if (localStart + 30 > buf.length || buf.readUInt32LE(localStart) !== 0x04034b50) return null;

  const localNameLen = buf.readUInt16LE(localStart + 26);
  const localExtraLen = buf.readUInt16LE(localStart + 28);
  const localHeaderLen = 30 + localNameLen + localExtraLen;

  // Region [regionStart, regionEnd) is the whole local-file block of the
  // target entry, including any trailing data descriptor. The next entry's
  // local header (or the CD start) bounds it exactly.
  const sorted = [...entries].sort((a, b) => a.localHeaderOffset - b.localHeaderOffset);
  const idx = sorted.indexOf(target);
  const regionStart = target.localHeaderOffset;
  const regionEnd = idx + 1 < sorted.length ? sorted[idx + 1].localHeaderOffset : index.cdOffset;
  if (regionEnd < regionStart || regionEnd > buf.length) return null;

  const newCompressed = zlib.deflateRawSync(newContent);
  const newCrc = crc32(newContent);
  const newLocalBlockLen = localHeaderLen + newCompressed.length;
  const delta = newLocalBlockLen - (regionEnd - regionStart);
  const newCdOffset = index.cdOffset + delta;

  if (newCdOffset >= 0xffffffff || newLocalBlockLen >= 0xffffffff) return null;

  // Rebuild the target's local file header from its own bytes (keeps the
  // version/time/date fields and name+extra bytes intact), clearing the data
  // descriptor flag since the sizes it carries are now known up front.
  const localHeader = Buffer.from(buf.slice(localStart, localStart + localHeaderLen));
  const newFlags = localHeader.readUInt16LE(6) & ~0x08;
  localHeader.writeUInt16LE(newFlags, 6);
  localHeader.writeUInt16LE(8, 8); // DEFLATE
  localHeader.writeUInt32LE(newCrc, 14);
  localHeader.writeUInt32LE(newCompressed.length, 18);
  localHeader.writeUInt32LE(newContent.length, 22);

  // Rebuild the central directory, patching only what moved.
  const cdRecords: Buffer[] = [];
  for (const entry of entries) {
    const recordLen = 46 + entry.nameBytes.length + entry.extraBytes.length + entry.commentBytes.length;
    const record = Buffer.from(buf.slice(entry.recordStart, entry.recordStart + recordLen));
    if (entry.name === entryName) {
      record.writeUInt16LE(newFlags, 8);
      record.writeUInt16LE(8, 10); // DEFLATE
      record.writeUInt32LE(newCrc, 16);
      record.writeUInt32LE(newCompressed.length, 20);
      record.writeUInt32LE(newContent.length, 24);
    } else if (entry.localHeaderOffset > regionStart) {
      record.writeUInt32LE(entry.localHeaderOffset + delta, 42);
    }
    cdRecords.push(record);
  }
  const newCd = Buffer.concat(cdRecords);

  // End of central directory: same record + archive comment, updated bounds.
  const eocd = searchLastSignature(buf, EOCD_SIG, 65557);
  if (eocd < 0 || buf.readUInt16LE(eocd + 4) !== 0 || buf.readUInt16LE(eocd + 6) !== 0)
    return null; // single-disk archives only
  const oldCommentLen = buf.readUInt16LE(eocd + 20);
  const newEocd = Buffer.alloc(22 + oldCommentLen);
  newEocd.writeUInt32LE(EOCD_SIG, 0);
  newEocd.writeUInt16LE(0, 4); // disk number
  newEocd.writeUInt16LE(0, 6); // cd start disk
  newEocd.writeUInt16LE(entries.length, 8); // entries on this disk
  newEocd.writeUInt16LE(entries.length, 10); // total entries
  newEocd.writeUInt32LE(newCd.length, 12); // cd size
  newEocd.writeUInt32LE(newCdOffset, 16); // cd offset
  newEocd.writeUInt16LE(oldCommentLen, 20);
  if (oldCommentLen) buf.copy(newEocd, 22, eocd + 22, eocd + 22 + oldCommentLen);

  return Buffer.concat([
    buf.slice(0, regionStart),
    localHeader,
    newCompressed,
    buf.slice(regionEnd, index.cdOffset),
    newCd,
    newEocd,
  ]);
}