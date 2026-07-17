import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { RankingEntry } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type RankingEntryJSON } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const { entryId } = await params;
    if (!isValidObjectId(entryId))
      throw new HttpError(404, "Ranking entry not found.");
    await dbConnect();

    const entry = await RankingEntry.findById(entryId);
    if (!entry) throw new HttpError(404, "Ranking entry not found.");
    const clubId = String(entry.clubId);
    const actorEmail = await requireManagerOf(clubId);

    const body = (await req.json().catch(() => null)) as {
      points?: unknown;
      note?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    if (body.points !== undefined) {
      if (typeof body.points !== "number" || !Number.isInteger(body.points))
        throw new HttpError(400, "Points must be a whole number.");
      entry.points = body.points;
    }
    if (body.note !== undefined) {
      const note = typeof body.note === "string" ? body.note.trim() : "";
      entry.note = note || undefined;
    }

    await entry.save();

    await logAction({
      actorEmail,
      action: "ranking.entry.update",
      clubId,
      message: `Updated ranking entry for ${entry.playerName} (now ${entry.points} points).`,
    });

    return NextResponse.json({ entry: serialize<RankingEntryJSON>(entry) });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    const { entryId } = await params;
    if (!isValidObjectId(entryId))
      throw new HttpError(404, "Ranking entry not found.");
    await dbConnect();

    const entry = await RankingEntry.findById(entryId);
    if (!entry) throw new HttpError(404, "Ranking entry not found.");
    const clubId = String(entry.clubId);
    const actorEmail = await requireManagerOf(clubId);

    const playerName = entry.playerName as string;
    const points = entry.points as number;
    await entry.deleteOne();

    await logAction({
      actorEmail,
      action: "ranking.entry.delete",
      clubId,
      message: `Deleted ranking entry for ${playerName} (${points} points).`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
