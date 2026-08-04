import { describe, expect, it } from "vitest";
import { isAllowedUploadType, toAccountantJSON } from "../accountant";
import { isOcrSupported, runOcr } from "../ocr";

describe("upload type gating", () => {
  it("allows images and PDF for upload", () => {
    expect(isAllowedUploadType("image/png")).toBe(true);
    expect(isAllowedUploadType("image/jpeg")).toBe(true);
    expect(isAllowedUploadType("application/pdf")).toBe(true);
  });
  it("rejects other types for upload", () => {
    expect(isAllowedUploadType("text/plain")).toBe(false);
    expect(isAllowedUploadType("application/zip")).toBe(false);
  });
  it("only images are OCR-able for now", () => {
    expect(isOcrSupported("image/png")).toBe(true);
    expect(isOcrSupported("application/pdf")).toBe(false);
  });
});

describe("runOcr dispatch", () => {
  it("returns 'unsupported' for a PDF without invoking any engine", async () => {
    const res = await runOcr("tesseract", Buffer.from("x"), "application/pdf");
    expect(res.status).toBe("unsupported");
    expect(res.text).toBe("");
  });

  it("the cloud engine fails clearly when no API key is configured", async () => {
    const saved = process.env.GOOGLE_VISION_API_KEY;
    delete process.env.GOOGLE_VISION_API_KEY;
    const res = await runOcr("cloud", Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png");
    expect(res.status).toBe("failed");
    expect(res.error).toMatch(/GOOGLE_VISION_API_KEY/);
    if (saved !== undefined) process.env.GOOGLE_VISION_API_KEY = saved;
  });
});

describe("toAccountantJSON", () => {
  it("shapes the JSON and NEVER includes the raw data bytes", () => {
    const now = new Date("2026-08-04T10:00:00.000Z");
    const json = toAccountantJSON({
      _id: "doc1",
      clubId: "club1",
      uploadedByEmail: "m@example.com",
      fileName: "invoice.png",
      mimeType: "image/png",
      size: 1234,
      data: Buffer.from([1, 2, 3, 4]),
      ocrEngine: "tesseract",
      status: "parsed",
      extractedText: "Total: 100",
      documentType: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });
    expect("data" in json).toBe(false);
    expect(json.fileName).toBe("invoice.png");
    expect(json.status).toBe("parsed");
    expect(json.extractedText).toBe("Total: 100");
    expect(json.createdAt).toBe("2026-08-04T10:00:00.000Z");
  });
});
