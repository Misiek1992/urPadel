import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, Tournament } from "@/lib/models";
import { serialize, type ClubJSON, type TournamentJSON } from "@/lib/types";
import { computeStandings, typeLabel } from "@/lib/engine";
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

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  if (!isValidObjectId(tournamentId)) notFound();
  await dbConnect();
  const doc = await Tournament.findById(tournamentId).lean();
  if (!doc) notFound();
  const tournament = serialize<TournamentJSON>(doc);
  const clubRaw = await Club.findById(tournament.clubId).lean();
  const club = clubRaw ? serialize<ClubJSON>(clubRaw) : null;

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
            <Badge tone="blue">{typeLabel(tournament.type)}</Badge>
            {isActive ? (
              <Badge tone="volt" className="animate-pulse">
                Live · Round {round?.number}
              </Badge>
            ) : (
              <Badge tone="slate">Finished {formatDate(tournament.finishedAt ?? tournament.playedAt)}</Badge>
            )}
            <span className="text-xs text-slate-500">
              {tournament.matchPoints} points per match · {tournament.courts.length}{" "}
              court{tournament.courts.length === 1 ? "" : "s"} ·{" "}
              {tournament.entrants.length} entrants
            </span>
          </span>
        }
        actions={
          <Link href={`/t/${tournament._id}/results`} className="btn btn-secondary btn-sm">
            Results table
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
                  {row.points} pts
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
              Round {round.number}
              {round.isFinal && (
                <Badge tone="volt" className="ml-2 align-middle">
                  FINAL — seeded by ranking
                </Badge>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              Enter the score at your court when the match ends.
            </p>
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
                      Court screen →
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
                        <span className="badge badge-slate">vs</span>
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
              <span className="badge badge-slate mr-2">Resting</span>
              {round.byes.map((id) => map[id]?.name ?? id).join(", ")}
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="section-title mb-4">
          {isActive ? "Live standings" : "Final standings"}
        </h2>
        <StandingsTable standings={standings} />
      </section>

      {pastRounds.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Previous rounds</h2>
          <div className="space-y-3">
            {[...pastRounds].reverse().map((r) => (
              <Collapsible
                key={r.number}
                title={`Round ${r.number}${r.isFinal ? " — FINAL" : ""}`}
                meta={
                  <span className="text-xs text-slate-500">
                    {r.matches.length} matches
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
                        <td className="text-xs text-slate-500">Resting</td>
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
