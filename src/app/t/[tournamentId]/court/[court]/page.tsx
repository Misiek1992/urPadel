import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Tournament } from "@/lib/models";
import { serialize, type TournamentJSON } from "@/lib/types";
import { computeStandings } from "@/lib/engine";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { Badge } from "@/components/ui";
import { AutoRefresh } from "@/components/public/AutoRefresh";
import { ScoreForm } from "@/components/public/ScoreForm";
import { StandingsTable } from "@/components/public/StandingsTable";
import { currentRound, entrantMap, sideNames } from "@/components/public/helpers";

export const dynamic = "force-dynamic";

export default async function CourtPage({
  params,
}: {
  params: Promise<{ tournamentId: string; court: string }>;
}) {
  const { tournamentId, court: courtParam } = await params;
  if (!isValidObjectId(tournamentId)) notFound();
  const court = decodeURIComponent(courtParam);
  const t = createT(await getLocale());

  await dbConnect();
  const doc = await Tournament.findById(tournamentId).lean();
  if (!doc) notFound();
  const tournament = serialize<TournamentJSON>(doc);
  if (!tournament.courts.includes(court)) notFound();

  const map = entrantMap(tournament.entrants);
  const standings = computeStandings(tournament.entrants, tournament.rounds);
  const round = currentRound(tournament);
  const isActive = tournament.status === "active";
  const match = round?.matches.find((m) => m.court === court) ?? null;
  const done = match ? match.scoreA != null && match.scoreB != null : false;

  return (
    <div className="mx-auto max-w-3xl space-y-8 text-center">
      <AutoRefresh enabled={isActive} intervalMs={5000} />

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
        {isActive && round && (
          <p className="mt-2 text-lg text-slate-400">
            {t("courtPage.round", { number: round.number })}
            {round.isFinal && (
              <Badge tone="volt" className="ml-2 align-middle">
                {t("courtPage.finalBadge")}
              </Badge>
            )}
          </p>
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

      <div className="text-left">
        <h2 className="section-title mb-3 text-center">{t("courtPage.top5")}</h2>
        <StandingsTable standings={standings} t={t} limit={5} showRecord={false} />
      </div>
    </div>
  );
}
