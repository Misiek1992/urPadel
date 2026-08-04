import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { AccountantDocument } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import {
  isAllowedUploadType,
  MAX_UPLOAD_BYTES,
  requireAccountantFeature,
  toAccountantJSON,
} from "@/lib/accountant";
import { runOcr } from "@/lib/ocr";

export const dynamic = "force-dynamic";

const LIST_FIELDS =
  "clubId uploadedByEmail fileName mimeType size ocrEngine status extractedText documentType error createdAt updatedAt";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    await requireManagerOf(clubId);
    await requireAccountantFeature(clubId);
    await dbConnect();

    // LIST_FIELDS deliberately omits `data` (select:false anyway) so bytes
    // never ship in the list.
    const docs = await AccountantDocument.find({ clubId }, LIST_FIELDS)
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({
      documents: (docs as Record<string, unknown>[]).map(toAccountantJSON),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    const actorEmail = await requireManagerOf(clubId);
    const engine = await requireAccountantFeature(clubId);
    await dbConnect();

    const body = (await req.json().catch(() => null)) as {
      fileName?: unknown;
      mimeType?: unknown;
      dataBase64?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
    const dataBase64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
    if (!fileName) throw new HttpError(400, "A file name is required.");
    if (!isAllowedUploadType(mimeType))
      throw new HttpError(400, "Unsupported file type — upload an image or PDF.");
    if (!dataBase64) throw new HttpError(400, "File data is required.");

    // Strip a possible data-URL prefix, then decode.
    const base64 = dataBase64.includes(",") ? dataBase64.slice(dataBase64.indexOf(",") + 1) : dataBase64;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) throw new HttpError(400, "File data is empty or invalid.");
    if (buffer.length > MAX_UPLOAD_BYTES)
      throw new HttpError(400, "File is too large (max 10 MB).");

    // Persist the document first (so it's stored regardless of OCR outcome),
    // then run OCR and record the result.
    const doc = await AccountantDocument.create({
      clubId,
      uploadedByEmail: actorEmail,
      fileName,
      mimeType,
      size: buffer.length,
      data: buffer,
      ocrEngine: engine,
      status: "processing",
    });

    const ocr = await runOcr(engine, buffer, mimeType);
    doc.extractedText = ocr.text;
    doc.status = ocr.status;
    doc.error = ocr.error ?? null;
    await doc.save();

    await logAction({
      actorEmail,
      action: "club.accountant.upload",
      clubId,
      message: `Uploaded "${fileName}" to the Accountant Assistant (${engine} OCR → ${ocr.status}).`,
    });

    return NextResponse.json({ document: toAccountantJSON(doc.toObject()) });
  } catch (e) {
    return apiError(e);
  }
}
