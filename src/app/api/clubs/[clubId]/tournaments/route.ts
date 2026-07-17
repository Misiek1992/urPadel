import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, Tournament } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type TournamentJSON, type TournamentType } from "@/lib/types";
import {
  TOURNAMENT_TYPES,
  generateNextRound,
  isTeamType,
  makeEntrantId,
  typeLabel,
  validateTournamentSetup,
  type EngineRound,
  type Entrant,
} from "@/lib/engine";

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
    const tournaments = await Tournament.find({ clubId })
      .sort({ playedAt: -1 })
      .lean();
    return NextResponse.json({
      tournaments: serialize<TournamentJSON[]>(tournaments),
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
    await dbConnect();

    const club = await Club.findById(clubId).lean();
    if (!club) throw new HttpError(404, "Club not found.");
    const clubName = (club as unknown as { name: string }).name;

    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      type?: unknown;
      matchPoints?: unknown;
      courts?: unknown;
      entrants?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new HttpError(400, "Tournament name is required.");

    const type = body.type as TournamentType;
    if (!TOURNAMENT_TYPES.some((t) => t.value === type))
      throw new HttpError(400, "Invalid tournament type.");

    const matchPoints = body.matchPoints;
    if (
      typeof matchPoints !== "number" ||
      !Number.isInteger(matchPoints) ||
      matchPoints < 4 ||
      matchPoints > 128
    )
      throw new HttpError(400, "Match points must be a whole number between 4 and 128.");

    // Courts: trimmed, non-empty, de-duplicated (order preserved).
    const courts: string[] = [];
    if (Array.isArray(body.courts)) {
      for (const raw of body.courts) {
        const court = typeof raw === "string" ? raw.trim() : "";
        if (court && !courts.includes(court)) courts.push(court);
      }
    }

    // Entrants: assign server-side ids; team formats need exactly 2 players.
    const team = isTeamType(type);
    const entrantsIn = Array.isArray(body.entrants) ? body.entrants : [];
    const entrants: Entrant[] = [];
    const usedIds = new Set<string>();
    const usedNames = new Set<string>();
    for (const raw of entrantsIn) {
      const input = (raw ?? {}) as { name?: unknown; players?: unknown };
      let entrantName = typeof input.name === "string" ? input.name.trim() : "";
      let players: string[] = [];
      if (team) {
        players = Array.isArray(input.players)
          ? input.players.map((p) => (typeof p === "string" ? p.trim() : ""))
          : [];
        if (players.length !== 2 || players.some((p) => !p))
          throw new HttpError(400, "Each team needs exactly 2 players.");
        if (!entrantName) entrantName = `${players[0]} / ${players[1]}`;
      }
      if (!entrantName) throw new HttpError(400, "Every entrant needs a name.");
      const lower = entrantName.toLowerCase();
      if (usedNames.has(lower))
        throw new HttpError(400, `Duplicate entrant name: "${entrantName}".`);
      usedNames.add(lower);
      let id = makeEntrantId();
      while (usedIds.has(id)) id = makeEntrantId();
      usedIds.add(id);
      entrants.push({ id, name: entrantName, players });
    }

    const setupError = validateTournamentSetup(type, entrants.length, courts.length);
    if (setupError) throw new HttpError(400, setupError);

    let firstRound: EngineRound;
    try {
      firstRound = generateNextRound({ type, entrants, courts, rounds: [] });
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "Could not generate round 1."
      );
    }

    const tournament = await Tournament.create({
      clubId,
      name,
      type,
      matchPoints,
      courts,
      entrants,
      rounds: [firstRound],
      status: "active",
      pointsAwarded: false,
      playedAt: new Date(),
    });

    await logAction({
      actorEmail,
      action: "tournament.create",
      clubId,
      tournamentId: String(tournament._id),
      message: `Created ${typeLabel(type)} tournament "${name}" in "${clubName}" (${
        entrants.length
      } entrants, ${courts.length} court${courts.length === 1 ? "" : "s"}).`,
    });

    return NextResponse.json({ tournament: serialize<TournamentJSON>(tournament) });
  } catch (e) {
    return apiError(e);
  }
}
