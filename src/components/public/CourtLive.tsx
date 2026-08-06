"use client";

// Live-updating court view: polls the tournament JSON directly instead of
// AutoRefresh's router.refresh() (which re-runs the whole server tree,
// layout queries included, on every tick). This is the tightest interval in
// the app (every device sitting at a court polls it), so it's the one place
// worth the extra client-side plumbing.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";
import { computeStandings, isCompetitiveType, type Entrant } from "@/lib/engine";
import { isPlayable, leagueTable } from "@/lib/competitive";
import type { TournamentJSON } from "@/lib/types";
import { ScoreForm } from "./ScoreForm";
import { StandingsTable } from "./StandingsTable";
import { TieScoreForm } from "@/components/competitive/TieScoreForm";
import { currentRound, entrantMap, sideNames } from "./helpers";

const POLL_MS = 5000;

export function CourtLive({
  tournamentId,
  court,
  initialTournament,
}: {
  tournamentId: string;
  court: string;
  initialTournament: TournamentJSON;
}) {
  const t = useT();
  const [tournament, setTournament] = useState(initialTournament);

  useEffect(() => {
    if (tournament.status !== "active") return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { tournament?: TournamentJSON };
        if (!cancelled && data.tournament) setTournament(data.tournament);
      } catch {
        // Transient network hiccup — the next tick will retry.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tournament.status, tournamentId]);

  const competitive = isCompetitiveType(tournament.type);
  const scoring = tournament.scoring ?? "points";
  const bestOfSets = tournament.config?.bestOfSets ?? 3;
  const map = entrantMap(tournament.entrants);
  const standings = competitive
    ? tournament.type === "league-team"
      ? leagueTable(tournament.entrants as Entrant[], tournament.ties ?? [], scoring)
      : []
    : computeStandings(tournament.entrants, tournament.rounds);
  const round = competitive ? null : currentRound(tournament);
  const isActive = tournament.status === "active";
  const match = round?.matches.find((m) => m.court === court) ?? null;
  const done = match ? match.scoreA != null && match.scoreB != null : false;
  // Competitive: the playable tie currently assigned to this court.
  const courtTie = competitive
    ? (tournament.ties ?? []).find(
        (x) => x.court === court && isPlayable(x, scoring)
      ) ?? null
    : null;

  return (
    <>
      <div>
        <Link
          href={`/t/${tournament._id}`}
          className="text-xs font-semibold text-slate-500 hover:text-volt-300"
        >
          {t("courtPage.backTo", { name: tournament.name })}
        </Link>
        <h1 className="mt-2 text-4xl font-extrabold uppercase tracking-wide text-volt-300 sm:text-5xl">
          {court}
        </h1>
        {isActive && !competitive && round && (
          <p className="mt-2 text-lg text-slate-400">
            {t("courtPage.round", { number: round.number })}
            {round.isFinal && (
              <Badge tone="volt" className="ml-2 align-middle">
                {t("courtPage.finalBadge")}
              </Badge>
            )}
          </p>
        )}
        {isActive && competitive && courtTie?.label && (
          <p className="mt-2 text-lg text-slate-400">{courtTie.label}</p>
        )}
      </div>

      {!isActive ? (
        <div className="card card-pad py-12">
          <p className="text-2xl font-bold text-white">{t("courtPage.finishedTitle")}</p>
          <Link
            href={`/t/${tournament._id}/results`}
            className="btn btn-primary btn-lg mt-6"
          >
            {t("courtPage.seeResults")}
          </Link>
        </div>
      ) : competitive ? (
        courtTie ? (
          <div className="card card-pad py-8">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="text-right">
                {sideNames([courtTie.sideA.entrantId!], map).map((n) => (
                  <p key={n} className="text-2xl font-extrabold text-white sm:text-3xl">
                    {n}
                  </p>
                ))}
              </div>
              <span className="text-xl font-bold text-slate-500">{t("courtPage.vs")}</span>
              <div className="text-left">
                {sideNames([courtTie.sideB.entrantId!], map).map((n) => (
                  <p key={n} className="text-2xl font-extrabold text-white sm:text-3xl">
                    {n}
                  </p>
                ))}
              </div>
            </div>
            <div className="mt-8 border-t border-white/10 pt-8">
              <TieScoreForm
                tournamentId={tournament._id}
                tieId={courtTie.id}
                scoring={scoring}
                bestOfSets={bestOfSets}
                size="xl"
              />
            </div>
          </div>
        ) : (
          <div className="card card-pad py-12">
            <p className="text-xl font-semibold text-white">{t("competitive.noneReady")}</p>
            <Link href={`/t/${tournament._id}`} className="btn btn-secondary btn-md mt-6">
              {t("resultsPage.liveView")}
            </Link>
          </div>
        )
      ) : !match ? (
        <div className="card card-pad py-12">
          <p className="text-xl font-semibold text-white">
            {t("courtPage.noMatchTitle", { round: round?.number ?? "" })}
          </p>
          <p className="mt-2 text-sm text-slate-400">{t("courtPage.noMatchHint")}</p>
        </div>
      ) : (
        <div className="card card-pad py-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="text-right">
              {sideNames(match.sideA, map).map((n) => (
                <p key={n} className="text-2xl font-extrabold text-white sm:text-3xl">
                  {n}
                </p>
              ))}
            </div>
            <span className="text-xl font-bold text-slate-500">{t("courtPage.vs")}</span>
            <div className="text-left">
              {sideNames(match.sideB, map).map((n) => (
                <p key={n} className="text-2xl font-extrabold text-white sm:text-3xl">
                  {n}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-8">
            {done ? (
              <>
                <p className="text-6xl font-extrabold text-volt-300">
                  {match.scoreA}
                  <span className="mx-3 text-slate-600">:</span>
                  {match.scoreB}
                </p>
                <p className="mt-4 text-sm text-slate-400">{t("courtPage.resultSaved")}</p>
              </>
            ) : (
              <ScoreForm
                tournamentId={tournament._id}
                roundNumber={round!.number}
                court={court}
                matchPoints={tournament.matchPoints}
                size="lg"
              />
            )}
          </div>
        </div>
      )}

      {standings.length > 0 && (
        <div className="text-left">
          <h2 className="section-title mb-3 text-center">{t("courtPage.top5")}</h2>
          <StandingsTable standings={standings} t={t} limit={5} showRecord={false} />
        </div>
      )}
    </>
  );
}
