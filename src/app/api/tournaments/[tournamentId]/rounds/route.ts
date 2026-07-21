import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Tournament } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type TournamentJSON } from "@/lib/types";
import { generateNextRound, type EngineRound } from "@/lib/engine";

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
    const clubId = String(tournament.clubId);
    const actorEmail = await requireManagerOf(clubId);

    if (tournament.status !== "active")
      throw new HttpError(400, "The tournament is already closed.");

    const body = (await req.json().catch(() => null)) as {
      final?: unknown;
    } | null;
    const final = body?.final === true;

    const rounds = tournament.rounds as EngineRound[];
    const current = rounds[rounds.length - 1];
    if (current) {
      if (current.isFinal)
        throw new HttpError(
          400,
          "The final round has been played — close the tournament."
        );
      const missing = current.matches.some(
        (m) => m.scoreA == null || m.scoreB == null
      );
      if (missing)
        throw new HttpError(
          400,
          `Enter all results for round ${current.number} first.`
        );
    }

    let nextRound: EngineRound;
    try {
      nextRound = generateNextRound({
        type: tournament.type,
        entrants: tournament.entrants,
        courts: tournament.courts,
        rounds,
        final,
      });
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "Could not generate the next round."
      );
    }

    // Push atomically, guarded by the round count we read: if someone else
    // (e.g. a double-click, or two managers) already advanced the round
    // since we computed `nextRound` from this snapshot, $expr fails to match
    // and we discard the computed round rather than pushing a duplicate.
    const expectedLength = rounds.length;
    const pushResult = await Tournament.updateOne(
      {
        _id: tournament._id,
        status: "active",
        $expr: { $eq: [{ $size: "$rounds" }, expectedLength] },
      },
      { $push: { rounds: nextRound } }
    );
    if (pushResult.matchedCount === 0) {
      const fresh = await Tournament.findById(tournament._id);
      if (!fresh) throw new HttpError(404, "Tournament not found.");
      if (fresh.status !== "active")
        throw new HttpError(400, "The tournament is already closed.");
      throw new HttpError(
        409,
        "This round has already started — refresh to see it."
      );
    }

    const updated = await Tournament.findById(tournament._id);

    await logAction({
      actorEmail,
      action: "tournament.round",
      clubId,
      tournamentId,
      message: `Started ${final ? "FINAL " : ""}round ${nextRound.number} of "${
        tournament.name
      }".`,
    });

    return NextResponse.json({
      tournament: serialize<TournamentJSON>(updated),
    });
  } catch (e) {
    return apiError(e);
  }
}
