// Shared helpers for the Accountant Assistant document routes: the per-club
// feature gate, upload limits, and a safe JSON mapper that guarantees the raw
// `data` bytes never cross the wire.
import { dbConnect } from "./db";
import { Club } from "./models";
import { HttpError } from "./auth";
import type { AccountantDocumentJSON, OcrEngine } from "./types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** Images (OCR-able now) plus PDF (stored now, text extraction is a later seam). */
export function isAllowedUploadType(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

/**
 * Asserts the Accountant Assistant is enabled for `clubId` (on top of the
 * caller's `requireManagerOf`) and returns that club's configured OCR engine.
 * 404 if the club is gone, 403 if the feature is off — so a manager can't hit
 * these routes for a disabled feature.
 */
export async function requireAccountantFeature(clubId: string): Promise<OcrEngine> {
  await dbConnect();
  const club = await Club.findById(clubId, "features").lean();
  if (!club) throw new HttpError(404, "Club not found.");
  const feature = (club as unknown as {
    features?: { accountantAssistant?: { enabled?: boolean; ocrEngine?: OcrEngine } };
  }).features?.accountantAssistant;
  if (!feature?.enabled) {
    throw new HttpError(403, "The Accountant Assistant isn't enabled for this club.");
  }
  return feature.ocrEngine ?? "tesseract";
}

/** Maps a document doc/lean-object to JSON, explicitly omitting `data` bytes. */
export function toAccountantJSON(doc: Record<string, unknown>): AccountantDocumentJSON {
  return {
    _id: String(doc._id),
    clubId: String(doc.clubId),
    uploadedByEmail: (doc.uploadedByEmail as string | null) ?? null,
    fileName: String(doc.fileName),
    mimeType: String(doc.mimeType),
    size: Number(doc.size),
    ocrEngine: doc.ocrEngine as OcrEngine,
    status: doc.status as AccountantDocumentJSON["status"],
    extractedText: (doc.extractedText as string) ?? "",
    documentType: (doc.documentType as string | null) ?? null,
    error: (doc.error as string | null) ?? null,
    createdAt: new Date(doc.createdAt as string | Date).toISOString(),
    updatedAt: new Date(doc.updatedAt as string | Date).toISOString(),
  };
}
