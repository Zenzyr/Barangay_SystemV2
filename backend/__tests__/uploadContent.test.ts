import fs from "fs";
import os from "os";
import path from "path";
import { Request, Response } from "express";
import {
  detectFileSignature,
  validateUploadedFileContents,
} from "../utils/upload";

type MockResponse = Response & { statusCode: number; body: unknown };

function mockResponse(): MockResponse {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as MockResponse;
}

describe("detectFileSignature", () => {
  it("detects jpeg", () => {
    expect(detectFileSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "jpeg",
    );
  });

  it("detects png", () => {
    expect(
      detectFileSignature(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("png");
  });

  it("detects webp", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WEBP"),
    ]);
    expect(detectFileSignature(webp)).toBe("webp");
  });

  it("detects gif, bmp and pdf", () => {
    expect(detectFileSignature(Buffer.from("GIF89a"))).toBe("gif");
    expect(detectFileSignature(Buffer.from("BMxxxx"))).toBe("bmp");
    expect(detectFileSignature(Buffer.from("%PDF-1.7"))).toBe("pdf");
  });

  it("returns null for unknown content", () => {
    expect(detectFileSignature(Buffer.from([1, 2, 3, 4, 5, 6]))).toBeNull();
    expect(detectFileSignature(Buffer.alloc(0))).toBeNull();
  });
});

describe("validateUploadedFileContents", () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bims-upload-"));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function run(file: {
    path: string;
    mimetype: string;
  }): Promise<{ res: MockResponse; nexted: boolean }> {
    const req = { file } as unknown as Request;
    const res = mockResponse();
    let nexted = false;
    await validateUploadedFileContents(req, res, () => {
      nexted = true;
    });
    return { res, nexted };
  }

  it("accepts a genuine png whose bytes match its type", async () => {
    const filePath = path.join(dir, "ok.png");
    fs.writeFileSync(
      filePath,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
    );

    const { res, nexted } = await run({ path: filePath, mimetype: "image/png" });

    expect(nexted).toBe(true);
    expect(res.statusCode).toBe(0);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("rejects a spoofed png whose bytes are actually a pdf and deletes it", async () => {
    const filePath = path.join(dir, "spoof.png");
    fs.writeFileSync(filePath, Buffer.from("%PDF-1.7"));

    const { res, nexted } = await run({ path: filePath, mimetype: "image/png" });

    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("rejects an unsupported declared type", async () => {
    const filePath = path.join(dir, "note.txt");
    fs.writeFileSync(filePath, Buffer.from("just text"));

    const { res, nexted } = await run({ path: filePath, mimetype: "text/plain" });

    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(400);
  });

  it("accepts multiple files (image + pdf) that all match their types", async () => {
    const logo = path.join(dir, "logo.jpg");
    const doc = path.join(dir, "doc.pdf");
    fs.writeFileSync(logo, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    fs.writeFileSync(doc, Buffer.from("%PDF-1.4"));

    const req = {
      files: {
        logo: [{ path: logo, mimetype: "image/jpeg" }],
        document: [{ path: doc, mimetype: "application/pdf" }],
      },
    } as unknown as Request;
    const res = mockResponse();
    let nexted = false;

    await validateUploadedFileContents(req, res, () => {
      nexted = true;
    });

    expect(nexted).toBe(true);
  });

  it("rejects when any file in a multi-file upload is spoofed", async () => {
    const logo = path.join(dir, "logo2.jpg");
    const doc = path.join(dir, "doc2.pdf");
    fs.writeFileSync(logo, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    fs.writeFileSync(doc, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // png, declared pdf

    const req = {
      files: {
        logo: [{ path: logo, mimetype: "image/jpeg" }],
        document: [{ path: doc, mimetype: "application/pdf" }],
      },
    } as unknown as Request;
    const res = mockResponse();
    let nexted = false;

    await validateUploadedFileContents(req, res, () => {
      nexted = true;
    });

    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(400);
  });
});
