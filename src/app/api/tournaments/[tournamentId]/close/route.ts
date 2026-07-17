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

    tournament.status = "finished";
    tournament.finishedAt = new Date();
    await tournament.save();

    if (!tournament.pointsAwarded) {
      await awardTournamentPoints(tournament);
      tournament.pointsAwarded = true;
      await tournament.save();
    }

    await logAction({
      actorEmail,
      action: "tournament.close",
      clubId,
      tournamentId,
      message: `Closed "${tournament.name}" and awarded ranking points (100/90/…/10, others 1).`,
    });

    return NextResponse.json({
      tournament: serialize<TournamentJSON>(tournament),
    });
  } catch (e) {
    return apiError(e);
  }
}
