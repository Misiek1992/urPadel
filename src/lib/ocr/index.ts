// OCR engine abstraction. Two interchangeable engines, chosen per club by the
// superadmin: `tesseract` (self-hosted, no key) and `cloud` (Google Cloud
// Vision, needs an API key). Text extraction only for now — per-document-type
// field parsing (invoice/receipt → structured data) is a later seam that
// consumes `extractedText`.
import type { OcrEngine } from "@/lib/types";

export interface OcrResult {
  text: string;
  status: "parsed" | "failed" | "unsupported";
  error?: string;
}

/** MIME types the OCR engines can read today (raster images). */
export function isOcrSupported(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Runs OCR with the selected engine. Never throws — failures come back as a
 * `failed`/`unsupported` status with a human-readable `error`, so the caller
 * can persist the document either way.
 */
export async function runOcr(
  engine: OcrEngine,
  bytes: Buffer,
  mimeType: string
): Promise<OcrResult> {
  if (!isOcrSupported(mimeType)) {
    return {
      text: "",
      status: "unsupported",
      error:
        "Text extraction currently supports image files only (PNG, JPEG, WebP…). PDF support is coming next.",
    };
  }
  try {
    const text =
      engine === "cloud"
        ? await (await import("./cloud")).cloudExtract(bytes, mimeType)
        : await (await import("./tesseract")).tesseractExtract(bytes);
    return { text: text.trim(), status: "parsed" };
  } catch (e) {
    return {
      text: "",
      status: "failed",
      error: e instanceof Error ? e.message : "OCR failed.",
    };
  }
}
