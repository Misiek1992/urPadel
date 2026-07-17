import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Tournament } from "@/lib/models";
import { serialize, type TournamentJSON } from "@/lib/types";
import { computeStandings, typeLabel } from "@/lib/engine";
import { Badge, PageHeader } from "@/components/ui";
import { ManagerDenied, resolveActiveClub } from "@/components/manager/access";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { TournamentControl } from "@/components/manager/TournamentControl";
import { StandingsTable } from "@/components/public/StandingsTable";
import { formatDate } from "@/components/public/helpers";

export const dynamic = "force-dynamic";

export default async function ManagerTournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ club?: string }>;
}) {
  const viewer = await getViewer();
  const { tournamentId } = await params;
  const { club: clubParam } = await searchParams;
  if (!isValidObjectId(tournamentId)) notFound();

  await dbConnect();
  const doc = await Tournament.findById(tournamentId).lean();
  if (!doc) notFound();
  const tournament = serialize<TournamentJSON>(doc);

  // The viewer must manage THIS tournament's club.
  const owningClub = viewer.managedClubs.find(
    (c) => c._id === tournament.clubId
  );
  if (!owningClub) return <ManagerDenied viewer={viewer} />;
  const activeClub =
    resolveActiveClub(viewer, clubParam ?? tournament.clubId) ?? owningClub;

  const standings = computeStandings(tournament.entrants, tournament.rounds);
  const isActive = tournament.status === "active";
  const round = tournament.rounds[tournament.rounds.length - 1];

  return (
    <div>
      <PageHeader
        title={tournament.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{typeLabel(tournament.type)}</Badge>
            {isActive ? (
              <Badge tone="volt" className="animate-pulse">
                Live · Round {round?.number}
              </Badge>
            ) : (
              <Badge tone="slate">
                Finished {formatDate(tournament.finishedAt ?? tournament.playedAt)}
              </Badge>
            )}
            <span className="text-xs text-slate-500">
              {tournament.matchPoints} pts/match · {tournament.entrants.length}{" "}
              entrants · {tournament.courts.length} courts
            </span>
          </span>
        }
        actions={
          <>
            <Link href={`/t/${tournament._id}`} className="btn btn-secondary btn-sm">
              Public view
            </Link>
            <Link
              href={`/t/${tournament._id}/results`}
              className="btn btn-secondary btn-sm"
            >
              Results table
            </Link>
          </>
        }
      />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={activeClub._id} />
      </div>

      <div className="mb-8">
        <h2 className="section-title mb-4">
          {isActive ? "Live standings" : "Final standings"}
        </h2>
        <StandingsTable standings={standings} />
      </div>

      <TournamentControl tournament={tournament} clubId={owningClub._id} />
    </div>
  );
}
