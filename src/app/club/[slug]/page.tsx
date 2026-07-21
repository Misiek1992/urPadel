import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { Tournament } from "@/lib/models";
import { serialize, type TournamentJSON } from "@/lib/types";
import { computeStandings } from "@/lib/engine";
import { computeClubRanking } from "@/lib/ranking";
import { formatLabel } from "@/lib/i18n/formats";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getClubBySlug } from "@/lib/loaders";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/components/public/helpers";
import { medalFor } from "@/components/public/StandingsTable";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) return {};
  const ranking = await computeClubRanking(club._id);
  const description = [
    club.city,
    club.description,
    ranking[0] ? `🥇 ${ranking[0].playerName}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: club.name,
    description,
    openGraph: { title: club.name, description },
    twitter: { card: "summary_large_image", title: club.name, description },
  };
}

export default async function ClubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = createT(await getLocale());
  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const tournamentsRaw = await Tournament.find({ clubId: club._id })
    .sort({ playedAt: -1 })
    .lean();
  const tournaments = serialize<TournamentJSON[]>(tournamentsRaw);
  const active = tournaments.filter((t2) => t2.status === "active");
  const finished = tournaments.filter((t2) => t2.status === "finished");
  const ranking = await computeClubRanking(club._id);

  return (
    <div className="space-y-10">
      <PageHeader
        title={club.name}
        subtitle={
          <>
            {club.city && (
              <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-volt-300">
                {club.city}
              </span>
            )}
            {club.description}
          </>
        }
      />

      {active.length > 0 && (
        <section>
          <h2 className="section-title mb-4">{t("clubPage.happeningNow")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((tour) => (
              <Link
                key={tour._id}
                href={`/t/${tour._id}`}
                className="card card-pad transition-colors hover:border-volt-400/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-white">{tour.name}</h3>
                  <span className="badge badge-volt animate-pulse">
                    {t("clubPage.liveNow")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  <Badge tone="blue">{formatLabel(t, tour.type)}</Badge>
                  <span className="ml-2">
                    {t("tournamentPage.round")} {tour.rounds.length} ·{" "}
                    {t("tournamentPage.entrantsCount", { count: tour.entrants.length })}{" "}
                    ·{" "}
                    {tour.courts.length === 1
                      ? t("tournamentPage.courtsCount", { count: tour.courts.length })
                      : t("tournamentPage.courtsCountPlural", {
                          count: tour.courts.length,
                        })}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-4">{t("clubPage.tournaments")}</h2>
        {finished.length === 0 ? (
          <EmptyState
            title={t("clubPage.noFinishedTitle")}
            hint={t("clubPage.noFinishedHint")}
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t("clubPage.date")}</th>
                  <th>{t("clubPage.tournament")}</th>
                  <th>{t("clubPage.format")}</th>
                  <th>{t("clubPage.winner")}</th>
                  <th className="text-right">{t("clubPage.rounds")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {finished.map((tour) => {
                  const winner = computeStandings(tour.entrants, tour.rounds)[0];
                  return (
                    <tr key={tour._id}>
                      <td className="whitespace-nowrap text-xs text-slate-400">
                        {formatDate(tour.playedAt)}
                      </td>
                      <td className="font-semibold text-white">
                        <Link href={`/t/${tour._id}`} className="hover:text-volt-300">
                          {tour.name}
                        </Link>
                      </td>
                      <td>
                        <Badge tone="blue">{formatLabel(t, tour.type)}</Badge>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="mr-1">🏆</span>
                        <span className="font-semibold text-volt-300">
                          {winner?.name ?? "—"}
                        </span>
                      </td>
                      <td className="text-right text-slate-400">{tour.rounds.length}</td>
                      <td className="text-right">
                        <Link
                          href={`/t/${tour._id}/results`}
                          className="text-xs font-semibold text-volt-300 hover:text-volt-400"
                        >
                          {t("clubPage.results")}
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

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">{t("clubPage.ranking")}</h2>
          <p className="text-xs text-slate-500">{t("clubPage.rollingWindow")}</p>
        </div>
        {ranking.length === 0 ? (
          <EmptyState
            title={t("clubPage.noRankingTitle")}
            hint={t("clubPage.noRankingHint")}
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-12">{t("clubPage.position")}</th>
                  <th>{t("clubPage.player")}</th>
                  <th className="text-right">{t("clubPage.points")}</th>
                  <th className="text-right">{t("clubPage.tournamentsPlayed")}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => {
                  const medal = medalFor(row.position);
                  return (
                    <tr
                      key={row.playerName}
                      className={cn(row.position <= 3 && "bg-volt-400/[0.04]")}
                    >
                      <td
                        className={cn(
                          "font-bold",
                          row.position === 1
                            ? "text-volt-300"
                            : row.position === 2
                              ? "text-slate-300"
                              : row.position === 3
                                ? "text-amber-600"
                                : "text-slate-500"
                        )}
                      >
                        {medal ?? row.position}
                      </td>
                      <td className="font-semibold text-white">{row.playerName}</td>
                      <td className="text-right text-base font-extrabold text-volt-300">
                        {row.total}
                      </td>
                      <td className="text-right text-slate-400">
                        {row.tournamentsPlayed}
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
