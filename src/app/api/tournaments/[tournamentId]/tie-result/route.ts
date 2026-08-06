import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, Tournament } from "@/lib/models";
import {
  apiError,
  getSessionEmail,
  HttpError,
  isSuperAdminEmail,
} from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type ScoringMode, type TieJSON, type TieScoreJSON, type TournamentJSON } from "@/lib/types";
import { isCompetitiveType } from "@/lib/engine";
import {
  assignCourts,
  hydrateCompetitive,
  isPlayable,
  resolveTies,
  validateScore,
  winnerOf,
  type CompTournament,
} from "@/lib/competitive";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sanitizeEntrantsForPublic } from "@/lib/privacy";

export const dynamic = "force-dynamic";

// Public score entry for competitive ties — mirrors /result's guards.
const RESULT_LIMIT = 20;
const RESULT_WINDOW_MS = 60_000;

/** Truncate names + re-resolve advancement for the public response. */
function publicTournament(tournament: TournamentJSON): TournamentJSON {
  const t = hydrateCompetitive(tournament);
  return { ...t, entrants: sanitizeEntrantsForPublic(t.entrants) };
}

function parseScore(raw: unknown, scoring: ScoringMode): TieScoreJSON | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (scoring === "sets") {
    if (!Array.isArray(r.sets)) return null;
    if (r.sets.length > 5) return null;
    return {
      sets: r.sets.map((s) => {
        const set = (s ?? {}) as Record<string, unknown>;
        return { a: Number(set.a), b: Number(set.b) };
      }),
    };
  }
  return { a: Number(r.a), b: Number(r.b) };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;
    if (!isValidObjectId(tournamentId)) throw new HttpError(404, "Tournament not found.");
    if (!rateLimit(`tie:${clientIp(req)}:${tournamentId}`, RESULT_LIMIT, RESULT_WINDOW_MS))
      throw new HttpError(429, "Too many requests — please slow down and try again shortly.");
    await dbConnect();

    const tournament = await Tournament.findById(tournamentId).select("+scorePin");
    if (!tournament) throw new HttpError(404, "Tournament not found.");
    if (!isCompetitiveType(tournament.type))
      throw new HttpError(400, "This tournament doesn't use bracket/league scoring.");
    if (tournament.status === "finished")
      throw new HttpError(400, "The tournament is finished — results are locked.");

    const scoring = (tournament.scoring ?? "points") as ScoringMode;
    const body = (await req.json().catch(() => null)) as {
      tieId?: unknown;
      score?: unknown;
      pin?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const tieId = typeof body.tieId === "string" ? body.tieId : "";
    if (!tieId) throw new HttpError(400, "tieId is required.");

    const ties = serialize<TieJSON[]>(tournament.ties);
    const tie = ties.find((x) => x.id === tieId);
    if (!tie) throw new HttpError(404, "Match not found.");
    if (!isPlayable(tie, scoring)) {
      // Either already scored, or its participants aren't decided yet.
      if (tie.winner != null)
        throw new HttpError(409, "This match already has a result.");
      throw new HttpError(400, "This match isn't ready to be played yet.");
    }

    const score = parseScore(body.score, scoring);
    if (!score) throw new HttpError(400, "Invalid score.");
    const validation = validateScore(score, scoring, tournament.config ?? null);
    if (!validation.ok) throw new HttpError(400, validation.error);
    const winner = winnerOf(score, scoring);
    if (!winner) throw new HttpError(400, "The match must have a winner.");

    // Manager (session) vs public (court PIN), same policy as /result.
    const email = await getSessionEmail();
    let isManager = false;
    if (email) {
      if (await isSuperAdminEmail(email)) {
        isManager = true;
      } else {
        const club = await Club.findById(tournament.clubId).lean();
        const managers = (((club as { managerEmails?: string[] } | null)?.managerEmails ?? []) as string[]).map(
          (m) => m.toLowerCase()
        );
        isManager = managers.includes(email);
      }
    }
    const scorePin = tournament.scorePin as string | null;
    if (!isManager && scorePin) {
      const pin = typeof body.pin === "string" ? body.pin.trim() : "";
      if (!pin)
        throw new HttpError(403, "This tournament requires a PIN to submit scores.", "pin_required");
      if (pin !== scorePin) throw new HttpError(403, "Incorrect PIN.", "pin_invalid");
    }

    // Atomically claim + record this tie's result: set score + winner only if
    // it's still unscored (winner null) and both sides are resolved. Two courts
    // reporting different ties touch different array elements; a double-submit
    // on the same tie fails the winner:null guard.
    const claim = await Tournament.updateOne(
      { _id: tournament._id, status: "active" },
      {
        $set: {
          "ties.$[t].score": score,
          "ties.$[t].winner": winner,
        },
      },
      {
        arrayFilters: [
          {
            "t.id": tieId,
            "t.winner": null,
            "t.sideA.entrantId": { $ne: null },
            "t.sideB.entrantId": { $ne: null },
          },
        ],
      }
    );

    if (claim.modifiedCount === 0) {
      // Lost the race, or it's already exactly this result (idempotent).
      const fresh = await Tournament.findById(tournament._id);
      if (!fresh) throw new HttpError(404, "Tournament not found.");
      const freshTie = serialize<TieJSON[]>(fresh.ties).find((x) => x.id === tieId);
      if (freshTie && JSON.stringify(freshTie.score) === JSON.stringify(score)) {
        return NextResponse.json({
          tournament: publicTournament(serialize<TournamentJSON>(fresh)),
        });
      }
      throw new HttpError(409, "This match already has a result.");
    }

    // Best-effort persist of the resulting advancement (downstream slot fills +
    // court assignment). This is derived data — every read re-resolves — so a
    // clobber by a concurrent submission self-heals on the next read.
    const afterClaim = await Tournament.findById(tournament._id);
    if (afterClaim) {
      const json = serialize<TournamentJSON>(afterClaim);
      const comp: CompTournament = {
        type: json.type,
        scoring,
        config: json.config ?? {},
        entrants: json.entrants,
        groups: json.groups ?? [],
        ties: json.ties ?? [],
      };
      const resolved = assignCourts(resolveTies(comp), json.courts, scoring);
      await Tournament.updateOne({ _id: tournament._id, status: "active" }, { $set: { ties: resolved } });
    }

    const updated = await Tournament.findById(tournament._id);

    await logAction({
      actorEmail: email ?? "court",
      action: "tournament.result",
      clubId: String(tournament.clubId),
      tournamentId,
      message: `Result for ${tie.label ?? "match"} (${tieId}) in "${tournament.name}".`,
    });

    return NextResponse.json({
      tournament: publicTournament(serialize<TournamentJSON>(updated)),
    });
  } catch (e) {
    return apiError(e);
  }
}
