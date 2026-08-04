import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { AccountantDocument } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { requireAccountantFeature } from "@/lib/accountant";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string; documentId: string }> }
) {
  try {
    const { clubId, documentId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    if (!isValidObjectId(documentId)) throw new HttpError(404, "Document not found.");
    const actorEmail = await requireManagerOf(clubId);
    await requireAccountantFeature(clubId);
    await dbConnect();

    // Scope the delete to the club so a document id from another club can't be
    // removed through this club's route.
    const doc = await AccountantDocument.findOne({ _id: documentId, clubId }, "fileName").lean();
    if (!doc) throw new HttpError(404, "Document not found.");
    await AccountantDocument.deleteOne({ _id: documentId, clubId });

    await logAction({
      actorEmail,
      action: "club.accountant.delete",
      clubId,
      message: `Deleted document "${(doc as unknown as { fileName: string }).fileName}" from the Accountant Assistant.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
