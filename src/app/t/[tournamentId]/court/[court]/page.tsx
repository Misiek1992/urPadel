import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Tournament } from "@/lib/models";
import { serialize, type TournamentJSON } from "@/lib/types";
import { CourtLive } from "@/components/public/CourtLive";

export const dynamic = "force-dynamic";

export default async function CourtPage({
  params,
}: {
  params: Promise<{ tournamentId: string; court: string }>;
}) {
  const { tournamentId, court: courtParam } = await params;
  if (!isValidObjectId(tournamentId)) notFound();
  const court = decodeURIComponent(courtParam);

  await dbConnect();
  const doc = await Tournament.findById(tournamentId).lean();
  if (!doc) notFound();
  const tournament = serialize<TournamentJSON>(doc);
  if (!tournament.courts.includes(court)) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8 text-center">
      <CourtLive tournamentId={tournament._id} court={court} initialTournament={tournament} />
    </div>
  );
}
