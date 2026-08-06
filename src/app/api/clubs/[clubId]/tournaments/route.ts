import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, Tournament } from "@/lib/models";
import { apiError, getSessionName, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import {
  sanitizeTournament,
  serialize,
  type TournamentJSON,
  type TournamentType,
} from "@/lib/types";
import { sanitizeEntrantsForPublic } from "@/lib/privacy";
import {
  TOURNAMENT_TYPES,
  generateNextRound,
  isCompetitiveType,
  isTeamType,
  makeEntrantId,
  typeLabel,
  validateTournamentSetup,
  type EngineRound,
  type Entrant,
} from "@/lib/engine";
import {
  buildInitialStructure,
  validateCompetitiveSetup,
} from "@/lib/competitive";
import type {
  CompetitiveConfigJSON,
  GroupJSON,
  ScoringMode,
  TieJSON,
} from "@/lib/types";

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
    const publicTournaments = serialize<TournamentJSON[]>(tournaments).map((tour) => ({
      ...tour,
      entrants: sanitizeEntrantsForPublic(tour.entrants),
    }));
    return NextResponse.json({ tournaments: publicTournaments });
  } catch (e) {
    return apiError(e);
  }
}

function intOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

/** Whitelist + coerce the competitive config for the given format. */
function parseCompetitiveConfig(
  type: TournamentType,
  scoring: ScoringMode,
  raw: unknown
): CompetitiveConfigJSON {
  const c = (raw ?? {}) as Record<string, unknown>;
  const config: CompetitiveConfigJSON = {};
  if (type === "knockout-team") {
    config.byeMode = c.byeMode === "playin" ? "playin" : "bye";
    config.thirdPlace = !!c.thirdPlace;
  } else if (type === "groups-team") {
    config.groupCount = intOr(c.groupCount, 2);
    config.advancePerGroup = intOr(c.advancePerGroup, 2);
    config.thirdPlace = !!c.thirdPlace;
  } else if (type === "league-team") {
    config.leagueDouble = !!c.leagueDouble;
  }
  if (scoring === "sets") {
    const best = intOr(c.bestOfSets, 3);
    config.bestOfSets = [1, 3, 5].includes(best) ? best : 3;
  }
  return config;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    const actorEmail = await requireManagerOf(clubId);
    const creatorName = await getSessionName();
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
      scorePin?: unknown;
      scoring?: unknown;
      config?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new HttpError(400, "Tournament name is required.");

    const type = body.type as TournamentType;
    if (!TOURNAMENT_TYPES.some((t) => t.value === type))
      throw new HttpError(400, "Invalid tournament type.");

    const competitive = isCompetitiveType(type);

    // Competitive formats (knockout/groups/league) don't use rally-point
    // match points; they carry a scoring mode + config instead. Only the
    // Americano/Mexicano path requires a valid matchPoints value.
    let matchPoints = 24;
    if (!competitive) {
      const mp = body.matchPoints;
      if (typeof mp !== "number" || !Number.isInteger(mp) || mp < 4 || mp > 128)
        throw new HttpError(400, "Match points must be a whole number between 4 and 128.");
      matchPoints = mp;
    }

    // Courts: trimmed, non-empty, de-duplicated (order preserved).
    if (Array.isArray(body.courts) && body.courts.length > 32)
      throw new HttpError(400, "A tournament can have at most 32 courts.");
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
    if (entrantsIn.length > 128)
      throw new HttpError(400, "A tournament can have at most 128 entrants.");
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

    // Optional PIN gating public score entry — 4 to 6 digits, or omitted/null.
    let scorePin: string | null = null;
    if (body.scorePin !== undefined && body.scorePin !== null && body.scorePin !== "") {
      if (typeof body.scorePin !== "string" || !/^\d{4,6}$/.test(body.scorePin))
        throw new HttpError(400, "PIN must be 4 to 6 digits.");
      scorePin = body.scorePin;
    }

    // Build the initial structure. Competitive formats populate ties/groups/
    // scoring/config and leave rounds empty; Americano/Mexicano generate round 1.
    let firstRound: EngineRound | null = null;
    let scoring: ScoringMode | null = null;
    let config: CompetitiveConfigJSON | null = null;
    let groups: GroupJSON[] = [];
    let ties: TieJSON[] = [];

    if (competitive) {
      scoring = body.scoring === "sets" ? "sets" : "points";
      config = parseCompetitiveConfig(type, scoring, body.config);
      const setupErr = validateCompetitiveSetup(type, scoring, config, entrants.length);
      if (!setupErr.ok) throw new HttpError(400, setupErr.error);
      try {
        const built = buildInitialStructure(type, config, entrants, courts, scoring);
        groups = built.groups;
        ties = built.ties;
      } catch (e) {
        throw new HttpError(
          400,
          e instanceof Error ? e.message : "Could not build the tournament."
        );
      }
    } else {
      try {
        firstRound = generateNextRound({ type, entrants, courts, rounds: [] });
      } catch (e) {
        throw new HttpError(
          400,
          e instanceof Error ? e.message : "Could not generate round 1."
        );
      }
    }

    const tournament = await Tournament.create({
      clubId,
      name,
      type,
      matchPoints,
      courts,
      entrants,
      rounds: firstRound ? [firstRound] : [],
      scoring,
      config,
      groups,
      ties,
      status: "active",
      pointsAwarded: false,
      playedAt: new Date(),
      createdByName: creatorName,
      scorePin,
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

    return NextResponse.json({
      tournament: sanitizeTournament(serialize<TournamentJSON>(tournament)),
    });
  } catch (e) {
    return apiError(e);
  }
}
