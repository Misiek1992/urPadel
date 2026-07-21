import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { computeStandings } from "@/lib/engine";
import { formatLabel } from "@/lib/i18n/formats";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getTournamentWithClub } from "@/lib/loaders";
import { Badge, PageHeader } from "@/components/ui";
import { AutoRefresh } from "@/components/public/AutoRefresh";
import { Collapsible } from "@/components/public/Collapsible";
import { ScoreForm } from "@/components/public/ScoreForm";
import { StandingsTable } from "@/components/public/StandingsTable";
import {
  currentRound,
  entrantMap,
  formatDate,
  sideNames,
} from "@/components/public/helpers";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}): Promise<Metadata> {
  const { tournamentId } = await params;
  const data = await getTournamentWithClub(tournamentId);
  if (!data) return {};
  const { tournament, club } = data;
  const t = createT(await getLocale());
  const isActive = tournament.status === "active";
  const winner = isActive ? null : computeStandings(tournament.entrants, tournament.rounds)[0];
  const description = [
    club?.name,
    formatLabel(t, tournament.type),
    isActive ? t("tournamentPage.live") : winner ? `🏆 ${winner.name}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: tournament.name,
    description,
    openGraph: { title: tournament.name, description },
    twitter: { card: "summary_large_image", title: tournament.name, description },
  };
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const data = await getTournamentWithClub(tournamentId);
  if (!data) notFound();
  const { tournament, club } = data;
  const t = createT(await getLocale());

  const map = entrantMap(tournament.entrants);
  const standings = computeStandings(tournament.entrants, tournament.rounds);
  const round = currentRound(tournament);
  const isActive = tournament.status === "active";
  const pastRounds = tournament.rounds.filter((r) => r !== round);
  const podium = standings.slice(0, 3);

  return (
    <div className="space-y-10">
      <AutoRefresh enabled={isActive} intervalMs={10000} />

      <PageHeader
        title={tournament.name}
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
              <Badge tone="volt" className="animate-pulse">
                {t("tournamentPage.live")} · {t("tournamentPage.round")}{" "}
                {round?.number}
              </Badge>
            ) : (
              <Badge tone="slate">
                {t("tournamentPage.finished", {
                  date: formatDate(tournament.finishedAt ?? tournament.playedAt),
                })}
              </Badge>
            )}
            <span className="text-xs text-slate-500">
              {t("tournamentPage.pointsPerMatch", { points: tournament.matchPoints })} ·{" "}
              {tournament.courts.length === 1
                ? t("tournamentPage.courtsCount", { count: tournament.courts.length })
                : t("tournamentPage.courtsCountPlural", {
                    count: tournament.courts.length,
                  })}{" "}
              · {t("tournamentPage.entrantsCount", { count: tournament.entrants.length })}
            </span>
          </span>
        }
        actions={
          <Link href={`/t/${tournament._id}/results`} className="btn btn-secondary btn-sm">
            {t("tournamentPage.resultsTable")}
          </Link>
        }
      />

      {!isActive && podium.length >= 2 && (
        <section className="grid gap-4 sm:grid-cols-3">
          {[1, 0, 2].map((idx) => {
            const row = podium[idx];
            if (!row) return <div key={idx} className="hidden sm:block" />;
            const position = idx + 1;
            return (
              <div
                key={row.entrantId}
                className={`card card-pad text-center ${
                  position === 1 ? "border-volt-400/40 sm:-mt-3" : ""
                }`}
              >
                <span className="text-3xl">{["🥇", "🥈", "🥉"][position - 1]}</span>
                <h3 className="mt-2 text-lg font-extrabold text-white">{row.name}</h3>
                {row.players && row.players.length > 0 && (
                  <p className="text-xs text-slate-400">{row.players.join(" · ")}</p>
                )}
                <p className="mt-1 text-2xl font-extrabold text-volt-300">
                  {row.points} {t("home.pointsLabel")}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {isActive && round && (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">
              {t("tournamentPage.round")} {round.number}
              {round.isFinal && (
                <Badge tone="volt" className="ml-2 align-middle">
                  {t("tournamentPage.finalBadge")}
                </Badge>
              )}
            </h2>
            <p className="text-xs text-slate-500">{t("tournamentPage.enterScoreHint")}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {round.matches.map((match) => {
              const aNames = sideNames(match.sideA, map);
              const bNames = sideNames(match.sideB, map);
              const done = match.scoreA != null && match.scoreB != null;
              return (
                <div key={match.court} className="card card-pad">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold uppercase tracking-wide text-volt-300">
                      {match.court}
                    </h3>
                    <Link
                      href={`/t/${tournament._id}/court/${encodeURIComponent(match.court)}`}
                      className="text-xs font-semibold text-slate-400 hover:text-volt-300"
                    >
                      {t("tournamentPage.courtScreen")}
                    </Link>
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="text-right">
                      {aNames.map((n) => (
                        <p key={n} className="font-semibold text-white">{n}</p>
                      ))}
                    </div>
                    <div className="text-center">
                      {done ? (
                        <p className="text-2xl font-extrabold text-volt-300">
                          {match.scoreA}
                          <span className="mx-1 text-slate-500">:</span>
                          {match.scoreB}
                        </p>
                      ) : (
                        <span className="badge badge-slate">{t("tournamentPage.vs")}</span>
                      )}
                    </div>
                    <div>
                      {bNames.map((n) => (
                        <p key={n} className="font-semibold text-white">{n}</p>
                      ))}
                    </div>
                  </div>
                  {!done && (
                    <div className="mt-4 border-t border-white/5 pt-4">
                      <ScoreForm
                        tournamentId={tournament._id}
                        roundNumber={round.number}
                        court={match.court}
                        matchPoints={tournament.matchPoints}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {round.byes.length > 0 && (
            <p className="mt-4 text-sm text-slate-400">
              <span className="badge badge-slate mr-2">{t("tournamentPage.resting")}</span>
              {round.byes.map((id) => map[id]?.name ?? id).join(", ")}
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="section-title mb-4">
          {isActive ? t("tournamentPage.liveStandings") : t("tournamentPage.finalStandings")}
        </h2>
        <StandingsTable standings={standings} t={t} />
      </section>

      {pastRounds.length > 0 && (
        <section>
          <h2 className="section-title mb-4">{t("tournamentPage.previousRounds")}</h2>
          <div className="space-y-3">
            {[...pastRounds].reverse().map((r) => (
              <Collapsible
                key={r.number}
                title={`${t("tournamentPage.round")} ${r.number}${r.isFinal ? ` — ${t("tournamentPage.finalBadge")}` : ""}`}
                meta={
                  <span className="text-xs text-slate-500">
                    {t("tournamentPage.matchesCount", { count: r.matches.length })}
                  </span>
                }
              >
                <table className="table-base">
                  <tbody>
                    {r.matches.map((m) => (
                      <tr key={m.court}>
                        <td className="w-32 text-xs font-bold uppercase tracking-wide text-slate-400">
                          {m.court}
                        </td>
                        <td className="text-right font-medium text-white">
                          {sideNames(m.sideA, map).join(" & ")}
                        </td>
                        <td className="w-20 text-center font-extrabold text-volt-300">
                          {m.scoreA != null ? `${m.scoreA} : ${m.scoreB}` : "—"}
                        </td>
                        <td className="font-medium text-white">
                          {sideNames(m.sideB, map).join(" & ")}
                        </td>
                      </tr>
                    ))}
                    {r.byes.length > 0 && (
                      <tr>
                        <td className="text-xs text-slate-500">
                          {t("tournamentPage.resting")}
                        </td>
                        <td colSpan={3} className="text-sm text-slate-400">
                          {r.byes.map((id) => map[id]?.name ?? id).join(", ")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Collapsible>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
