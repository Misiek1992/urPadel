import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { ClubPlayer } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type ClubPlayerJSON } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string; playerId: string }> }
) {
  try {
    const { clubId, playerId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    if (!isValidObjectId(playerId)) throw new HttpError(404, "Player not found.");
    const actorEmail = await requireManagerOf(clubId);
    await dbConnect();

    const player = await ClubPlayer.findById(playerId);
    if (!player || String(player.clubId) !== clubId)
      throw new HttpError(404, "Player not found.");

    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      email?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) throw new HttpError(400, "Player name cannot be empty.");
      const nameLower = name.toLowerCase();
      const conflict = await ClubPlayer.exists({
        clubId,
        nameLower,
        _id: { $ne: player._id },
      });
      if (conflict)
        throw new HttpError(409, `Player "${name}" already exists in this club.`);
      player.name = name;
      player.nameLower = nameLower;
    }
    if (body.email !== undefined) {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      player.email = email || undefined;
    }

    await player.save();

    await logAction({
      actorEmail,
      action: "players.update",
      clubId,
      message: `Updated player "${player.name}".`,
    });

    return NextResponse.json({ player: serialize<ClubPlayerJSON>(player) });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string; playerId: string }> }
) {
  try {
    const { clubId, playerId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    if (!isValidObjectId(playerId)) throw new HttpError(404, "Player not found.");
    const actorEmail = await requireManagerOf(clubId);
    await dbConnect();

    const player = await ClubPlayer.findById(playerId);
    if (!player || String(player.clubId) !== clubId)
      throw new HttpError(404, "Player not found.");
    const playerName = player.name as string;

    await player.deleteOne();

    await logAction({
      actorEmail,
      action: "players.delete",
      clubId,
      message: `Deleted player "${playerName}".`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
