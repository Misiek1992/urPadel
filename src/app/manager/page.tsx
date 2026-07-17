import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { ClubPlayer, RankingEntry, Tournament } from "@/lib/models";
import { serialize, type TournamentJSON } from "@/lib/types";
import { computeStandings } from "@/lib/engine";
import { formatLabel } from "@/lib/i18n/formats";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
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
  const t = createT(await getLocale());
  const { club: clubParam } = await searchParams;
  const activeClub = resolveActiveClub(viewer, clubParam);
  if (!activeClub) return <ManagerDenied viewer={viewer} t={t} />;
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
  const active = tournaments.filter((tour) => tour.status === "active");
  const recentFinished = tournaments
    .filter((tour) => tour.status === "finished")
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title={t("managerDashboard.title")}
        subtitle={
          <>
            {t("managerDashboard.managingPrefix")}{" "}
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
            {t("managerDashboard.newTournament")}
          </Link>
        }
      />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={clubId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("managerDashboard.statsPlayers")} value={playerCount} />
        <StatCard
          label={t("managerDashboard.statsTournaments")}
          value={tournamentCount}
          hint={t("managerDashboard.statsTournamentsHint")}
        />
        <StatCard label={t("managerDashboard.statsActive")} value={activeCount} />
        <StatCard
          label={t("managerDashboard.statsRanking")}
          value={rankingCount}
          hint={t("managerDashboard.statsRankingHint", { days: RANKING_WINDOW_DAYS })}
        />
      </div>

      {active.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title mb-4">{t("managerDashboard.activeTournaments")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((tour) => {
              const round = tour.rounds[tour.rounds.length - 1];
              const done = round
                ? round.matches.filter((m) => m.scoreA != null).length
                : 0;
              return (
                <Link
                  key={tour._id}
                  href={`/manager/tournaments/${tour._id}?club=${clubId}`}
                  className="card card-pad transition-colors hover:border-volt-400/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-white">{tour.name}</h3>
                    <span className="badge badge-volt animate-pulse">
                      {t("managerDashboard.live")}
                    </span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <Badge tone="blue">{formatLabel(t, tour.type)}</Badge>
                    <span>
                      {t("tournamentPage.round")} {round?.number ?? 0} ·{" "}
                      {t("managerDashboard.resultsIn", {
                        done,
                        total: round?.matches.length ?? 0,
                      })}
                    </span>
                  </p>
                  <p className="mt-3 text-xs font-semibold text-volt-300">
                    {t("managerDashboard.openControl")}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="section-title mb-4">{t("managerDashboard.recentTournaments")}</h2>
        {recentFinished.length === 0 ? (
          <EmptyState
            title={t("managerDashboard.noFinishedTitle")}
            hint={t("managerDashboard.noFinishedHint")}
            action={
              <Link
                href={`/manager/tournaments/new?club=${clubId}`}
                className="btn btn-primary"
              >
                {t("managerDashboard.createTournament")}
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t("managerDashboard.date")}</th>
                  <th>{t("managerDashboard.tournament")}</th>
                  <th>{t("managerDashboard.format")}</th>
                  <th>{t("managerDashboard.winner")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentFinished.map((tour) => {
                  const winner = computeStandings(tour.entrants, tour.rounds)[0];
                  return (
                    <tr key={tour._id}>
                      <td className="whitespace-nowrap text-xs text-slate-400">
                        {formatDate(tour.playedAt)}
                      </td>
                      <td className="font-semibold text-white">{tour.name}</td>
                      <td>
                        <Badge tone="blue">{formatLabel(t, tour.type)}</Badge>
                      </td>
                      <td className="whitespace-nowrap font-semibold text-volt-300">
                        🏆 {winner?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap text-right text-xs">
                        <Link
                          href={`/manager/tournaments/${tour._id}?club=${clubId}`}
                          className="font-semibold text-slate-300 hover:text-volt-300"
                        >
                          {t("managerDashboard.manage")}
                        </Link>
                        <span className="mx-1.5 text-slate-600">·</span>
                        <Link
                          href={`/t/${tour._id}/results`}
                          className="font-semibold text-volt-300 hover:text-volt-400"
                        >
                          {t("managerDashboard.results")}
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
