import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club } from "@/lib/models";
import { apiError, HttpError } from "@/lib/auth";
import { computeClubRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    await dbConnect();
    if (!(await Club.exists({ _id: clubId })))
      throw new HttpError(404, "Club not found.");
    const rows = await computeClubRanking(clubId);
    return NextResponse.json({ rows });
  } catch (e) {
    return apiError(e);
  }
}
