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
import { serialize, type TournamentJSON } from "@/lib/types";
import type { EngineRound } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;
    if (!isValidObjectId(tournamentId))
      throw new HttpError(404, "Tournament not found.");
    await dbConnect();

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) throw new HttpError(404, "Tournament not found.");
    if (tournament.status === "finished")
      throw new HttpError(400, "The tournament is finished — results are locked.");

    const body = (await req.json().catch(() => null)) as {
      roundNumber?: unknown;
      court?: unknown;
      scoreA?: unknown;
      scoreB?: unknown;
    } | null;
    if (!body || typeof body !== "object")
      throw new HttpError(400, "Invalid JSON body.");

    const roundNumber = body.roundNumber;
    if (typeof roundNumber !== "number" || !Number.isInteger(roundNumber))
      throw new HttpError(400, "roundNumber must be a whole number.");
    const court = typeof body.court === "string" ? body.court : "";
    if (!court) throw new HttpError(400, "court is required.");

    const { scoreA, scoreB } = body;
    const matchPoints = tournament.matchPoints as number;
    if (
      typeof scoreA !== "number" ||
      typeof scoreB !== "number" ||
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      scoreA < 0 ||
      scoreB < 0
    )
      throw new HttpError(400, "Scores must be whole numbers of 0 or more.");
    if (scoreA + scoreB !== matchPoints)
      throw new HttpError(
        400,
        `Scores must add up to ${matchPoints} (got ${scoreA + scoreB}).`
      );

    const rounds = tournament.rounds as EngineRound[];
    const round = rounds.find((r) => r.number === roundNumber);
    if (!round) throw new HttpError(404, "Round not found.");
    const match = round.matches.find((m) => m.court === court);
    if (!match) throw new HttpError(404, `No match on "${court}" in round ${roundNumber}.`);

    // Anyone at the court can enter a fresh result for the current round;
    // editing existing scores or past rounds is manager-only.
    const email = await getSessionEmail();
    let isManager = false;
    if (email) {
      if (await isSuperAdminEmail(email)) {
        isManager = true;
      } else {
        const club = await Club.findById(tournament.clubId).lean();
        const managers = (((club as { managerEmails?: string[] } | null)
          ?.managerEmails ?? []) as string[]).map((m) => m.toLowerCase());
        isManager = managers.includes(email);
      }
    }
    const isCurrentRound = round.number === rounds[rounds.length - 1].number;
    const isFreshResult = match.scoreA == null && match.scoreB == null;
    if (!isManager && !(isCurrentRound && isFreshResult))
      throw new HttpError(403, "Only the club manager can edit results.");

    // Write atomically instead of load-modify-save: two courts submitting
    // results at the same time both loaded the same document snapshot above,
    // so a plain `tournament.save()` here would let the second write clobber
    // the first (Mongoose serializes the *entire* rounds array on save). A
    // positional $set only ever touches this one match's two fields.
    const arrayFilters: Record<string, unknown>[] = [{ "r.number": roundNumber }];
    const matchFilter: Record<string, unknown> = { "m.court": court };
    if (!isManager) {
      // Re-assert freshness at the database level so two simultaneous "first
      // entry" submissions for the same match can't both succeed.
      matchFilter["m.scoreA"] = null;
    }
    arrayFilters.push(matchFilter);

    const updateResult = await Tournament.updateOne(
      { _id: tournament._id, status: "active" },
      {
        $set: {
          "rounds.$[r].matches.$[m].scoreA": scoreA,
          "rounds.$[r].matches.$[m].scoreB": scoreB,
        },
      },
      { arrayFilters }
    );

    if (updateResult.matchedCount === 0) {
      throw new HttpError(400, "The tournament is finished — results are locked.");
    }
    if (updateResult.modifiedCount === 0) {
      // The array filters matched nothing. Re-read to find out why: either
      // the round/court vanished (shouldn't happen, already checked above),
      // the value was already exactly this (harmless double-submit — treat
      // as success), or a manager-only edit was attempted without being one.
      const fresh = await Tournament.findById(tournament._id);
      if (!fresh) throw new HttpError(404, "Tournament not found.");
      const freshRounds = fresh.rounds as EngineRound[];
      const freshRound = freshRounds.find((r) => r.number === roundNumber);
      if (!freshRound) throw new HttpError(404, "Round not found.");
      const freshMatch = freshRound.matches.find((m) => m.court === court);
      if (!freshMatch)
        throw new HttpError(404, `No match on "${court}" in round ${roundNumber}.`);
      if (freshMatch.scoreA === scoreA && freshMatch.scoreB === scoreB) {
        return NextResponse.json({ tournament: serialize<TournamentJSON>(fresh) });
      }
      throw new HttpError(403, "Only the club manager can edit results.");
    }

    const updated = await Tournament.findById(tournament._id);

    await logAction({
      actorEmail: email ?? "court",
      action: "tournament.result",
      clubId: String(tournament.clubId),
      tournamentId,
      message: `Result on ${court}, round ${roundNumber} of "${tournament.name}": ${scoreA}–${scoreB}.`,
    });

    return NextResponse.json({
      tournament: serialize<TournamentJSON>(updated),
    });
  } catch (e) {
    return apiError(e);
  }
}
