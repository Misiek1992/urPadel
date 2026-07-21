import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { ClubPlayer, RankingEntry } from "@/lib/models";
import { serialize, type ClubPlayerJSON, type RankingEntryJSON } from "@/lib/types";
import { RANKING_WINDOW_DAYS } from "@/lib/ranking";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getClubBySlug } from "@/lib/loaders";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatDate } from "@/components/public/helpers";

export const dynamic = "force-dynamic";

const getPlayerWithEntries = cache(
  async (
    clubId: string,
    playerId: string
  ): Promise<{ player: ClubPlayerJSON; entries: RankingEntryJSON[] } | null> => {
    if (!isValidObjectId(playerId)) return null;
    await dbConnect();
    const playerDoc = await ClubPlayer.findOne({ _id: playerId, clubId }).lean();
    if (!playerDoc) return null;
    const player = serialize<ClubPlayerJSON>(playerDoc);
    const allRaw = await RankingEntry.find({ clubId }).sort({ date: -1 }).lean();
    const entries = serialize<RankingEntryJSON[]>(allRaw).filter(
      (e) => e.playerName.trim().toLowerCase() === player.nameLower
    );
    return { player, entries };
  }
);

function truncateLabel(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}): Promise<Metadata> {
  const { slug, playerId } = await params;
  const club = await getClubBySlug(slug);
  if (!club) return {};
  const data = await getPlayerWithEntries(club._id, playerId);
  if (!data) return {};
  return { title: `${data.player.name} · ${club.name}` };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}) {
  const { slug, playerId } = await params;
  const t = createT(await getLocale());
  const club = await getClubBySlug(slug);
  if (!club) notFound();
  const data = await getPlayerWithEntries(club._id, playerId);
  if (!data) notFound();
  const { player, entries } = data;

  const since = new Date(Date.now() - RANKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowPoints = entries
    .filter((e) => new Date(e.date) >= since)
    .reduce((sum, e) => sum + e.points, 0);

  const tournamentEntries = entries.filter((e) => e.kind === "tournament");
  const positions = tournamentEntries
    .map((e) => e.position)
    .filter((p): p is number => p != null);
  const bestFinish = positions.length > 0 ? Math.min(...positions) : null;
  const podiumCount = positions.filter((p) => p <= 3).length;

  const CHART_LIMIT = 10;
  const chartRows = tournamentEntries.slice(0, CHART_LIMIT);
  const maxPts = Math.max(1, ...chartRows.map((e) => e.points));
  const ROW_H = 34;
  const LABEL_W = 220;
  const BAR_MAX_W = 340;
  const VALUE_W = 50;
  const chartW = LABEL_W + BAR_MAX_W + VALUE_W;

  return (
    <div className="space-y-10">
      <PageHeader
        title={player.name}
        subtitle={
          <Link
            href={`/club/${club.slug}`}
            className="font-semibold text-volt-300 hover:text-volt-400"
          >
            {club.name}
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("playerPage.pointsWindow", { days: RANKING_WINDOW_DAYS })}
          value={windowPoints}
          hint={t("playerPage.pointsWindowHint")}
        />
        <StatCard
          label={t("playerPage.tournamentsPlayed")}
          value={tournamentEntries.length}
        />
        <StatCard
          label={t("playerPage.bestFinish")}
          value={bestFinish != null ? `#${bestFinish}` : "—"}
        />
        <StatCard label={t("playerPage.podiumCount")} value={podiumCount} />
      </section>

      {chartRows.length > 0 && (
        <section>
          <h2 className="section-title mb-4">{t("playerPage.pointsPerTournament")}</h2>
          <div className="card card-pad overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartRows.length * ROW_H}`}
              width="100%"
              height={chartRows.length * ROW_H}
              role="img"
              aria-label={t("playerPage.pointsPerTournament")}
            >
              {chartRows.map((row, i) => {
                const y = i * ROW_H;
                const barW = Math.max(4, (row.points / maxPts) * BAR_MAX_W);
                const podium = row.position != null && row.position <= 3;
                return (
                  <g key={row._id}>
                    <text
                      x={0}
                      y={y + ROW_H / 2 + 5}
                      fontSize={13}
                      fill="#94a3b8"
                      fontFamily="inherit"
                    >
                      {truncateLabel(row.tournamentName ?? "—", 28)}
                    </text>
                    <rect
                      x={LABEL_W}
                      y={y + 8}
                      width={barW}
                      height={ROW_H - 16}
                      rx={4}
                      fill={podium ? "#d9f954" : "#3b82f6"}
                    />
                    <text
                      x={LABEL_W + barW + 10}
                      y={y + ROW_H / 2 + 5}
                      fontSize={13}
                      fontWeight={700}
                      fill="#ffffff"
                      fontFamily="inherit"
                    >
                      {row.points}
                    </text>
                  </g>
                );
              })}
            </svg>
            {tournamentEntries.length > CHART_LIMIT && (
              <p className="mt-2 text-xs text-slate-500">
                {t("playerPage.chartCaption", { count: CHART_LIMIT })}
              </p>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-4">{t("playerPage.history")}</h2>
        {entries.length === 0 ? (
          <EmptyState
            title={t("playerPage.noHistoryTitle")}
            hint={t("playerPage.noHistoryHint")}
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t("clubPage.date")}</th>
                  <th>{t("clubPage.tournament")}</th>
                  <th className="text-right">{t("clubPage.position")}</th>
                  <th className="text-right">{t("clubPage.points")}</th>
                  <th>{t("playerPage.note")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id}>
                    <td className="whitespace-nowrap text-xs text-slate-400">
                      {formatDate(e.date)}
                    </td>
                    <td className="font-semibold text-white">
                      {e.tournamentId ? (
                        <Link
                          href={`/t/${e.tournamentId}/results`}
                          className="hover:text-volt-300"
                        >
                          {e.tournamentName ?? t("playerPage.adjustment")}
                        </Link>
                      ) : (
                        <span className="text-slate-300">
                          {e.tournamentName ?? t("playerPage.adjustment")}
                        </span>
                      )}
                    </td>
                    <td className="text-right text-slate-400">
                      {e.position ?? "—"}
                    </td>
                    <td className="text-right text-base font-extrabold text-volt-300">
                      {e.points}
                    </td>
                    <td className="text-xs text-slate-400">{e.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
