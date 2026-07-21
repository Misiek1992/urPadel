import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Tournament } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type TournamentJSON } from "@/lib/types";
import { awardTournamentPoints } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
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

    if (tournament.status === "finished")
      throw new HttpError(400, "The tournament is already closed.");

    // Atomically transition active -> finished: a conditional update guards
    // against two concurrent close requests both proceeding (the loser's
    // filter no longer matches once the winner has flipped the status).
    const finishedAt = new Date();
    const closeResult = await Tournament.updateOne(
      { _id: tournament._id, status: "active" },
      { $set: { status: "finished", finishedAt } }
    );
    if (closeResult.matchedCount === 0) {
      throw new HttpError(400, "The tournament is already closed.");
    }

    // Award ranking points exactly once: flip pointsAwarded false -> true
    // atomically and only the request that wins the flip runs the award.
    // Entrants/rounds haven't changed since we loaded `tournament` above, so
    // it's safe to compute standings from that in-memory snapshot.
    const awardResult = await Tournament.updateOne(
      { _id: tournament._id, pointsAwarded: false },
      { $set: { pointsAwarded: true } }
    );
    if (awardResult.modifiedCount === 1) {
      await awardTournamentPoints(tournament, { date: finishedAt });
    }

    const updated = await Tournament.findById(tournament._id);

    await logAction({
      actorEmail,
      action: "tournament.close",
      clubId,
      tournamentId,
      message: `Closed "${tournament.name}" and awarded ranking points (100/90/…/10, others 1).`,
    });

    return NextResponse.json({
      tournament: serialize<TournamentJSON>(updated),
    });
  } catch (e) {
    return apiError(e);
  }
}
