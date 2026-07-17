import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, Tournament } from "@/lib/models";
import { serialize, type ClubJSON, type TournamentJSON } from "@/lib/types";
import {
  computeStandings,
  roundPointsByEntrant,
  isTeamType,
  type EngineRound,
} from "@/lib/engine";
import { formatLabel } from "@/lib/i18n/formats";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { Badge, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { medalFor } from "@/components/public/StandingsTable";
import { entrantMap, formatDate, sideNames } from "@/components/public/helpers";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  if (!isValidObjectId(tournamentId)) notFound();
  const t = createT(await getLocale());
  await dbConnect();
  const doc = await Tournament.findById(tournamentId).lean();
  if (!doc) notFound();
  const tournament = serialize<TournamentJSON>(doc);
  const clubRaw = await Club.findById(tournament.clubId).lean();
  const club = clubRaw ? serialize<ClubJSON>(clubRaw) : null;

  const map = entrantMap(tournament.entrants);
  const standings = computeStandings(tournament.entrants, tournament.rounds);
  const isActive = tournament.status === "active";
  const roundPoints = tournament.rounds.map((r) =>
    roundPointsByEntrant(r as EngineRound)
  );
  const team = isTeamType(tournament.type);
  const who = team ? t("resultsPage.whoTeam") : t("resultsPage.whoPlayer");

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${tournament.name} — ${t("resultsPage.titleSuffix")}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {club && (
              <Link
                href={`/club/${club.slug}`}
                className="font-semibold text-volt-300 hover:text-volt-400"
              >
                {club.name}
              </Link>
            )}
            <Badge tone="blue">{formatLabel(t, tournament.type)}</Badge>
            {isActive ? (
              <Badge tone="volt">{t("resultsPage.live")}</Badge>
            ) : (
              <Badge tone="slate">
                {t("resultsPage.finished", {
                  date: formatDate(tournament.finishedAt ?? tournament.playedAt),
                })}
              </Badge>
            )}
          </span>
        }
        actions={
          <Link href={`/t/${tournament._id}`} className="btn btn-secondary btn-sm">
            {isActive ? t("resultsPage.liveView") : t("resultsPage.tournamentPage")}
          </Link>
        }
      />

      <section>
        <h2 className="section-title mb-4">{t("resultsPage.roundByRound")}</h2>
        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-12">{t("clubPage.position")}</th>
                <th>{team ? t("resultsPage.team") : t("resultsPage.player")}</th>
                {tournament.rounds.map((r) => (
                  <th key={r.number} className="text-center">
                    R{r.number}
                    {r.isFinal ? t("resultsPage.finalBadge") : ""}
                  </th>
                ))}
                <th className="text-right">{t("resultsPage.total")}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => {
                const position = i + 1;
                const medal = medalFor(position);
                return (
                  <tr
                    key={row.entrantId}
                    className={cn(position <= 3 && "bg-volt-400/[0.04]")}
                  >
                    <td
                      className={cn(
                        "font-bold",
                        position === 1
                          ? "text-volt-300"
                          : position === 2
                            ? "text-slate-300"
                            : position === 3
                              ? "text-amber-600"
                              : "text-slate-500"
                      )}
                    >
                      {medal ?? position}
                    </td>
                    <td>
                      <span className="font-semibold text-white">{row.name}</span>
                      {row.players && row.players.length > 0 && (
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {row.players.join(" · ")}
                        </span>
                      )}
                    </td>
                    {tournament.rounds.map((r, ri) => {
                      const pts = roundPoints[ri].get(row.entrantId);
                      return (
                        <td key={r.number} className="text-center">
                          {pts == null ? (
                            <span className="text-slate-600">–</span>
                          ) : (
                            <span className="font-semibold text-slate-200">{pts}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right text-base font-extrabold text-volt-300">
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t("resultsPage.cellHint", { who })}
        </p>
      </section>

      <section>
        <h2 className="section-title mb-4">{t("resultsPage.everyRoundDetail")}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {tournament.rounds.map((r) => (
            <div key={r.number} className="card card-pad">
              <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-volt-300">
                {r.isFinal
                  ? t("resultsPage.finalRoundLabel", { number: r.number })
                  : t("resultsPage.roundLabel", { number: r.number })}
              </h3>
              <table className="table-base">
                <tbody>
                  {r.matches.map((m) => (
                    <tr key={m.court}>
                      <td className="w-28 text-xs font-bold uppercase tracking-wide text-slate-400">
                        {m.court}
                      </td>
                      <td className="text-right text-sm font-medium text-white">
                        {sideNames(m.sideA, map).join(" & ")}
                      </td>
                      <td className="w-16 text-center text-sm font-extrabold text-volt-300">
                        {m.scoreA != null ? `${m.scoreA}:${m.scoreB}` : "—"}
                      </td>
                      <td className="text-sm font-medium text-white">
                        {sideNames(m.sideB, map).join(" & ")}
                      </td>
                    </tr>
                  ))}
                  {r.byes.length > 0 && (
                    <tr>
                      <td className="text-xs text-slate-500">
                        {t("resultsPage.resting")}
                      </td>
                      <td colSpan={3} className="text-xs text-slate-400">
                        {r.byes.map((id) => map[id]?.name ?? id).join(", ")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
