import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer, RankingEntry, Tournament } from "@/lib/models";
import {
  apiError,
  HttpError,
  requireManagerOf,
  requireSuperAdmin,
} from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type ClubJSON } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    const actorEmail = await requireManagerOf(clubId);
    await dbConnect();

    const club = await Club.findById(clubId);
    if (!club) throw new HttpError(404, "Club not found.");

    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      city?: unknown;
      description?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) throw new HttpError(400, "Club name cannot be empty.");
      club.name = name;
    }
    if (body.city !== undefined) {
      const city = typeof body.city === "string" ? body.city.trim() : "";
      club.city = city || undefined;
    }
    if (body.description !== undefined) {
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      club.description = description || undefined;
    }

    await club.save();

    await logAction({
      actorEmail,
      action: "club.update",
      clubId,
      message: `Updated club "${club.name}".`,
    });

    return NextResponse.json({ club: serialize<ClubJSON>(club) });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    const actorEmail = await requireSuperAdmin();
    await dbConnect();

    const club = await Club.findById(clubId);
    if (!club) throw new HttpError(404, "Club not found.");
    const clubName = club.name as string;

    await ClubPlayer.deleteMany({ clubId });
    await RankingEntry.deleteMany({ clubId });
    await Tournament.deleteMany({ clubId });
    await club.deleteOne();

    await logAction({
      actorEmail,
      action: "club.delete",
      clubId,
      message: `Deleted club "${clubName}" and all its players, tournaments and ranking entries.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
