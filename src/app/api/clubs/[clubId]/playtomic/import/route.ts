import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface ImportPlayerIn {
  name: string;
  email?: string;
}
interface ImportTournamentIn {
  name: string;
  players: ImportPlayerIn[];
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
      tournaments?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");
    if (!Array.isArray(body.tournaments) || body.tournaments.length === 0)
      throw new HttpError(400, "At least one tournament is required.");
    if (body.tournaments.length > 20)
      throw new HttpError(400, "Import at most 20 tournaments at a time.");

    // Parse + validate each tournament, deduping players within it (defensive
    // — this endpoint trusts the manager's own echoed selection from the
    // /playtomic/tournaments response they already saw, but shouldn't crash
    // on odd input).
    const tournamentsIn: { name: string; players: { name: string; email?: string }[] }[] = [];
    let totalPlayers = 0;
    for (const raw of body.tournaments as unknown[]) {
      const t = raw as Partial<ImportTournamentIn> | null;
      const name = typeof t?.name === "string" ? t.name.trim() : "";
      if (!name) throw new HttpError(400, "Every tournament needs a name.");
      const playersIn = Array.isArray(t?.players) ? t.players : [];
      const seen = new Set<string>();
      const players: { name: string; email?: string }[] = [];
      for (const p of playersIn as unknown[]) {
        const pin = p as Partial<ImportPlayerIn> | null;
        const pname = typeof pin?.name === "string" ? pin.name.trim() : "";
        if (!pname) continue;
        const lower = pname.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        const email = typeof pin?.email === "string" ? pin.email.trim() : "";
        players.push({ name: pname, email: email || undefined });
      }
      tournamentsIn.push({ name, players });
      totalPlayers += players.length;
    }
    if (totalPlayers > 500)
      throw new HttpError(400, "Import at most 500 players at a time.");

    // Union across all selected tournaments, deduped by email (if present)
    // else by lowercased name, for a single roster upsert pass.
    const unionByKey = new Map<string, { name: string; email?: string }>();
    for (const t of tournamentsIn) {
      for (const p of t.players) {
        const key = p.email ? p.email.toLowerCase() : p.name.toLowerCase();
        if (!unionByKey.has(key)) unionByKey.set(key, p);
      }
    }
    const uniquePlayers = Array.from(unionByKey.values());

    const existing = await ClubPlayer.find({
      clubId,
      nameLower: { $in: uniquePlayers.map((p) => p.name.toLowerCase()) },
    });
    const existingByNameLower = new Map(
      existing.map((doc) => [(doc.nameLower as string), doc])
    );

    const toCreate: { clubId: string; name: string; nameLower: string; email?: string }[] = [];
    const backfills: Promise<unknown>[] = [];
    let created = 0;
    let backfilled = 0;
    for (const p of uniquePlayers) {
      const nameLower = p.name.toLowerCase();
      const existingDoc = existingByNameLower.get(nameLower);
      if (!existingDoc) {
        toCreate.push({ clubId, name: p.name, nameLower, email: p.email });
        created++;
      } else if (p.email && !existingDoc.email) {
        existingDoc.email = p.email;
        backfills.push(existingDoc.save());
        backfilled++;
      }
    }
    if (toCreate.length > 0) await ClubPlayer.insertMany(toCreate);
    if (backfills.length > 0) await Promise.all(backfills);

    await logAction({
      actorEmail,
      action: "club.playtomic.import",
      clubId,
      message: `Imported ${tournamentsIn.length} tournament${
        tournamentsIn.length === 1 ? "" : "s"
      } from Playtomic to "${clubName}" (${created} new player${
        created === 1 ? "" : "s"
      }, ${backfilled} enriched with email).`,
    });

    return NextResponse.json({
      tournaments: tournamentsIn.map((t) => ({
        name: t.name,
        playerNames: t.players.map((p) => p.name),
      })),
      newPlayers: created,
    });
  } catch (e) {
    return apiError(e);
  }
}
