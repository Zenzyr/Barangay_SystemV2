import path from "path";
import multer from "multer";
import fs from "fs";
import { Request, Response, NextFunction } from "express";

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/bmp",
];

// Signup ID photos are strictly limited to the formats the frontend accepts.
const ID_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

const DOCUMENT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Field names that accept document (PDF) uploads in addition to images.
const DOCUMENT_FIELDS = new Set(["document"]);

// Field names for the 3 signup ID photos (must match ID_IMAGE_MIME).
const ID_IMAGE_FIELDS = new Set(["idFront", "idBack", "idSelfie"]);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, Date.now() + "-" + safeName);
  },
});

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ID_IMAGE_FIELDS.has(file.fieldname)
    ? ID_IMAGE_MIME
    : DOCUMENT_FIELDS.has(file.fieldname)
      ? DOCUMENT_MIME
      : IMAGE_MIME;

  if (!allowed.includes(file.mimetype)) {
    const err = new Error(
      ID_IMAGE_FIELDS.has(file.fieldname)
        ? "Invalid image type. Only JPG, PNG or WEBP images are allowed"
        : file.fieldname === "document"
          ? "Invalid document type. Only PDF and image files are allowed"
          : "Invalid image type. Only JPG, PNG, WEBP, HEIC or GIF images are allowed",
    ) as any;
    err.multerFileField = file.fieldname;
    cb(err);
    return;
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 20 },
});

const idImageMemoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 20 },
});

// Multer middleware that accepts 3 ID image files: front, back, selfie
export const uploadIdImages = idImageMemoryUpload.fields([
  { name: "idFront", maxCount: 1 },
  { name: "idBack", maxCount: 1 },
  { name: "idSelfie", maxCount: 1 },
]);

// Multer middleware for single profile picture upload
export const uploadProfilePicMiddleware = upload.single("profilePic");

export const uploadIdFrontBack = idImageMemoryUpload.fields([
  { name: "idFront", maxCount: 1 },
  { name: "idBack", maxCount: 1 },
]);

// Multer middleware for business document uploads
export const uploadBusinessFiles = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "document", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

// Multer middleware for adding images to an existing business
export const uploadBusinessImages = upload.fields([
  { name: "images", maxCount: 10 },
]);

// Multer middleware for updating business logo
export const uploadBusinessLogo = upload.single("logo");

// Multer middleware for updating business document
export const uploadBusinessDocument = upload.single("document");

// ── Settings / branding assets ───────────────────────────────────────
// Single image uploads used by the Settings hub (generic field names).
export const uploadSettingLogo = upload.single("logo");
export const uploadSettingSeal = upload.single("seal");
export const uploadOfficialPhoto = upload.single("photo");
export const uploadOfficialSignature = upload.single("signature");

/** Any single image field (used by shared asset upload endpoint). */
export const uploadSingleImage = upload.single("file");

// ── DOCX → PDF conversion ─────────────────────────────────────────
// Rendered Word templates are received in memory (never written to disk)
// and converted to PDF server-side via Word COM automation.
const docxStorage = multer.memoryStorage();

const DOCX_MIME = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
];

const docxFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (!DOCX_MIME.includes(file.mimetype)) {
    const err = new Error(
      "Invalid file type. Only .docx files are allowed",
    ) as any;
    err.multerFileField = file.fieldname;
    cb(err);
    return;
  }
  cb(null, true);
};

/** Single rendered .docx upload (kept in memory for conversion). */
export const uploadDocx = multer({
  storage: docxStorage,
  fileFilter: docxFileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

const BACKUP_FILE_MAX_SIZE = 100 * 1024 * 1024;

const backupFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const isJsonMime =
    file.mimetype === "application/json" || file.mimetype === "text/json";
  const isJsonExt = file.originalname.toLowerCase().endsWith(".json");
  if (!isJsonMime || !isJsonExt) {
    const err = new Error(
      "Invalid file type. Only .json backup files are allowed",
    ) as any;
    err.multerFileField = file.fieldname;
    cb(err);
    return;
  }
  cb(null, true);
};

export const uploadBackup = multer({
  storage: multer.memoryStorage(),
  fileFilter: backupFileFilter,
  limits: { fileSize: BACKUP_FILE_MAX_SIZE, files: 1 },
});

export function detectImageFormat(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "png";
  const riff = buf.toString("ascii", 0, 4);
  const webp = buf.toString("ascii", 8, 12);
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

export function isJpegPngWebpBuffer(buf: Buffer): boolean {
  return detectImageFormat(buf) !== null;
}

export function bufferToImageDataUri(
  buf: Buffer,
  format: "jpeg" | "png" | "webp",
): string {
  return `data:image/${format};base64,${buf.toString("base64")}`;
}

export async function isJpegPngWebpFile(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.promises.open(filePath, "r");
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fd.read(buf, 0, 12, 0);
    await fd.close();
    if (bytesRead < 11) return false;
    return isJpegPngWebpBuffer(buf);
  } catch {
    return false;
  }
}

// ── Content verification for disk-stored uploads ──────────────────────
// multer's fileFilter only sees the client-declared MIME type, which can be
// spoofed by renaming a file. These helpers sniff the real file signature so a
// disguised file cannot be persisted and forwarded to Cloudinary.
type FileSignature = "jpeg" | "png" | "webp" | "gif" | "bmp" | "heic" | "pdf";

export function detectFileSignature(buf: Buffer): FileSignature | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "png";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "bmp";
  if (buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") return "heic";
  return null;
}

const MIME_SIGNATURES: Record<string, FileSignature> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/heic": "heic",
  "image/heif": "heic",
  "application/pdf": "pdf",
};

function collectUploadedFiles(request: Request): Express.Multer.File[] {
  const out: Express.Multer.File[] = [];
  const files = request.files as
    | Express.Multer.File[]
    | Record<string, Express.Multer.File[]>
    | undefined;
  if (Array.isArray(files)) {
    out.push(...files);
  } else if (files && typeof files === "object") {
    for (const value of Object.values(files)) {
      if (Array.isArray(value)) out.push(...value);
    }
  }
  if (request.file) out.push(request.file);
  return out;
}

// Express middleware: verifies the real bytes of every disk-stored upload match
// the type the client claimed. Rejects (and removes) anything that does not.
export const validateUploadedFileContents = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  for (const file of collectUploadedFiles(request)) {
    const expected = MIME_SIGNATURES[file.mimetype];
    let actual: FileSignature | null = null;
    if (file.path) {
      try {
        const fd = await fs.promises.open(file.path, "r");
        const buf = Buffer.alloc(16);
        const { bytesRead } = await fd.read(buf, 0, 16, 0);
        await fd.close();
        actual = detectFileSignature(buf.subarray(0, bytesRead));
      } catch {
        actual = null;
      }
    }
    if (!expected || actual !== expected) {
      if (file.path) await fs.promises.unlink(file.path).catch(() => {});
      response.status(400).json({
        message:
          "File content does not match its type. Please upload a valid file.",
      });
      return;
    }
  }
  next();
};
