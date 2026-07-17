import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer, RankingEntry } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    const actorEmail = await requireManagerOf(clubId);
    await dbConnect();

    const club = await Club.findById(clubId).lean();
    if (!club) throw new HttpError(404, "Club not found.");
    const clubName = (club as unknown as { name: string }).name;

    const body = (await req.json().catch(() => null)) as {
      playerName?: unknown;
      points?: unknown;
      note?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const playerName =
      typeof body.playerName === "string" ? body.playerName.trim() : "";
    if (!playerName) throw new HttpError(400, "Player name is required.");

    const points = body.points;
    if (typeof points !== "number" || !Number.isInteger(points))
      throw new HttpError(400, "Points must be a whole number.");

    const note = typeof body.note === "string" ? body.note.trim() : "";

    const existingPlayer = await ClubPlayer.findOne({
      clubId,
      nameLower: playerName.toLowerCase(),
    }).lean();

    await RankingEntry.create({
      clubId,
      playerId: existingPlayer
        ? (existingPlayer as unknown as { _id: unknown })._id
        : undefined,
      playerName: existingPlayer
        ? (existingPlayer as unknown as { name: string }).name
        : playerName,
      points,
      kind: "adjustment",
      note: note || undefined,
      date: new Date(),
    });

    await logAction({
      actorEmail,
      action: "ranking.adjust",
      clubId,
      message: `Ranking adjustment in "${clubName}": ${
        points >= 0 ? "+" : ""
      }${points} points for ${playerName}${note ? ` (${note})` : ""}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
