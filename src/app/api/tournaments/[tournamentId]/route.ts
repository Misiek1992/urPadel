import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { RankingEntry, Tournament } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type TournamentJSON } from "@/lib/types";
import { computeStandings } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;
    if (!isValidObjectId(tournamentId))
      throw new HttpError(404, "Tournament not found.");
    await dbConnect();

    const doc = await Tournament.findById(tournamentId).lean();
    if (!doc) throw new HttpError(404, "Tournament not found.");

    const tournament = serialize<TournamentJSON>(doc);
    const standings = computeStandings(tournament.entrants, tournament.rounds);

    return NextResponse.json({ tournament, standings });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
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

    const tournamentName = tournament.name as string;
    if (tournament.pointsAwarded) {
      await RankingEntry.deleteMany({ tournamentId: tournament._id });
    }
    await tournament.deleteOne();

    await logAction({
      actorEmail,
      action: "tournament.delete",
      clubId,
      tournamentId,
      message: `Deleted tournament "${tournamentName}"${
        tournament.pointsAwarded ? " and its awarded ranking entries" : ""
      }.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
