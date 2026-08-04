import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { AccountantDocument } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { requireAccountantFeature } from "@/lib/accountant";

export const dynamic = "force-dynamic";

// The one route that reads the raw bytes — opts in with `.select("+data")`.
// Manager-of-club AND feature-enabled gated (financial PII); streams inline for
// viewing/download.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string; documentId: string }> }
) {
  try {
    const { clubId, documentId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    if (!isValidObjectId(documentId)) throw new HttpError(404, "Document not found.");
    await requireManagerOf(clubId);
    await requireAccountantFeature(clubId);
    await dbConnect();

    // Not `.lean()`: a lean query returns a Buffer field as a BSON Binary, so
    // a hydrated doc gives us a real Node Buffer for the bytes.
    const doc = await AccountantDocument.findOne({ _id: documentId, clubId }).select("+data");
    if (!doc) throw new HttpError(404, "Document not found.");
    const data = doc.get("data") as Buffer | undefined;
    if (!data) throw new HttpError(404, "Document has no stored file.");
    const mimeType = doc.get("mimeType") as string;
    const fileName = doc.get("fileName") as string;

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
