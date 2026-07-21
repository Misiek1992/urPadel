import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type ClubPlayerJSON } from "@/lib/types";

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
    const players = await ClubPlayer.find({ clubId }).sort({ nameLower: 1 }).lean();
    return NextResponse.json({ players: serialize<ClubPlayerJSON[]>(players) });
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
    await dbConnect();

    const club = await Club.findById(clubId).lean();
    if (!club) throw new HttpError(404, "Club not found.");
    const clubName = (club as unknown as { name: string }).name;

    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      email?: unknown;
      names?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    // Bulk import: { names: string[] }
    if (Array.isArray(body.names)) {
      if (body.names.length > 500)
        throw new HttpError(400, "Import at most 500 players at a time.");
      const seen = new Set<string>();
      const candidates: { name: string; nameLower: string }[] = [];
      for (const raw of body.names) {
        const name = typeof raw === "string" ? raw.trim() : "";
        if (!name) continue;
        const nameLower = name.toLowerCase();
        if (seen.has(nameLower)) continue;
        seen.add(nameLower);
        candidates.push({ name, nameLower });
      }
      if (candidates.length === 0)
        throw new HttpError(400, "No valid player names provided.");

      const existing = await ClubPlayer.find(
        { clubId, nameLower: { $in: candidates.map((c) => c.nameLower) } },
        "nameLower"
      ).lean();
      const existingSet = new Set(
        (existing as unknown as { nameLower: string }[]).map((e) => e.nameLower)
      );
      const toCreate = candidates.filter((c) => !existingSet.has(c.nameLower));

      const created =
        toCreate.length > 0
          ? await ClubPlayer.insertMany(
              toCreate.map((c) => ({
                clubId,
                name: c.name,
                nameLower: c.nameLower,
              }))
            )
          : [];

      await logAction({
        actorEmail,
        action: "players.import",
        clubId,
        message: `Imported ${created.length} players to "${clubName}" (${
          candidates.length - toCreate.length
        } skipped as already existing).`,
      });

      return NextResponse.json({ players: serialize<ClubPlayerJSON[]>(created) });
    }

    // Single add: { name, email? }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new HttpError(400, "Player name is required.");
    const nameLower = name.toLowerCase();
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (await ClubPlayer.exists({ clubId, nameLower }))
      throw new HttpError(409, `Player "${name}" already exists in this club.`);

    const player = await ClubPlayer.create({
      clubId,
      name,
      nameLower,
      email: email || undefined,
    });

    await logAction({
      actorEmail,
      action: "players.add",
      clubId,
      message: `Added player "${name}" to "${clubName}".`,
    });

    return NextResponse.json({ players: [serialize<ClubPlayerJSON>(player)] });
  } catch (e) {
    return apiError(e);
  }
}
