import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { ClubPlayer, RankingEntry, Tournament } from "@/lib/models";
import { serialize, type TournamentJSON } from "@/lib/types";
import { computeStandings, typeLabel } from "@/lib/engine";
import { RANKING_WINDOW_DAYS } from "@/lib/ranking";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ManagerDenied, resolveActiveClub } from "@/components/manager/access";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { formatDate } from "@/components/public/helpers";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const viewer = await getViewer();
  const { club: clubParam } = await searchParams;
  const activeClub = resolveActiveClub(viewer, clubParam);
  if (!activeClub) return <ManagerDenied viewer={viewer} />;
  const clubId = activeClub._id;

  await dbConnect();
  const since = new Date(Date.now() - RANKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [playerCount, tournamentCount, activeCount, rankingCount, tournamentsRaw] =
    await Promise.all([
      ClubPlayer.countDocuments({ clubId }),
      Tournament.countDocuments({ clubId }),
      Tournament.countDocuments({ clubId, status: "active" }),
      RankingEntry.countDocuments({ clubId, date: { $gte: since } }),
      Tournament.find({ clubId }).sort({ playedAt: -1 }).limit(12).lean(),
    ]);
  const tournaments = serialize<TournamentJSON[]>(tournamentsRaw);
  const active = tournaments.filter((t) => t.status === "active");
  const recentFinished = tournaments
    .filter((t) => t.status === "finished")
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Club manager"
        subtitle={
          <>
            Managing{" "}
            <Link
              href={`/club/${activeClub.slug}`}
              className="font-semibold text-volt-300 hover:text-volt-400"
            >
              {activeClub.name}
            </Link>
          </>
        }
        actions={
          <Link
            href={`/manager/tournaments/new?club=${clubId}`}
            className="btn btn-primary"
          >
            + New tournament
          </Link>
        }
      />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={clubId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Roster players" value={playerCount} />
        <StatCard label="Tournaments" value={tournamentCount} hint="all time" />
        <StatCard label="Active now" value={activeCount} />
        <StatCard
          label="Ranking entries"
          value={rankingCount}
          hint={`last ${RANKING_WINDOW_DAYS} days`}
        />
      </div>

      {active.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title mb-4">Active tournaments</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((t) => {
              const round = t.rounds[t.rounds.length - 1];
              const done = round
                ? round.matches.filter((m) => m.scoreA != null).length
                : 0;
              return (
                <Link
                  key={t._id}
                  href={`/manager/tournaments/${t._id}?club=${clubId}`}
                  className="card card-pad transition-colors hover:border-volt-400/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-white">{t.name}</h3>
                    <span className="badge badge-volt animate-pulse">Live</span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <Badge tone="blue">{typeLabel(t.type)}</Badge>
                    <span>
                      Round {round?.number ?? 0} · {done}/{round?.matches.length ?? 0}{" "}
                      results in
                    </span>
                  </p>
                  <p className="mt-3 text-xs font-semibold text-volt-300">
                    Open control board →
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="section-title mb-4">Recent tournaments</h2>
        {recentFinished.length === 0 ? (
          <EmptyState
            title="No finished tournaments yet"
            hint="Start your first one — players can be imported straight from Playtomic or CSV."
            action={
              <Link
                href={`/manager/tournaments/new?club=${clubId}`}
                className="btn btn-primary"
              >
                Create a tournament
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tournament</th>
                  <th>Format</th>
                  <th>Winner</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentFinished.map((t) => {
                  const winner = computeStandings(t.entrants, t.rounds)[0];
                  return (
                    <tr key={t._id}>
                      <td className="whitespace-nowrap text-xs text-slate-400">
                        {formatDate(t.playedAt)}
                      </td>
                      <td className="font-semibold text-white">{t.name}</td>
                      <td>
                        <Badge tone="blue">{typeLabel(t.type)}</Badge>
                      </td>
                      <td className="whitespace-nowrap font-semibold text-volt-300">
                        🏆 {winner?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap text-right text-xs">
                        <Link
                          href={`/manager/tournaments/${t._id}?club=${clubId}`}
                          className="font-semibold text-slate-300 hover:text-volt-300"
                        >
                          Manage
                        </Link>
                        <span className="mx-1.5 text-slate-600">·</span>
                        <Link
                          href={`/t/${t._id}/results`}
                          className="font-semibold text-volt-300 hover:text-volt-400"
                        >
                          Results
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
