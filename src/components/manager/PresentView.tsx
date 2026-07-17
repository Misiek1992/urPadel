"use client";

// Fullscreen "presenter" mode for running a live tournament: one big-screen
// view showing every court with score entry, round controls and a ranking
// popup — the only thing on screen while managers or players operate it.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, ErrorText, Modal, Spinner, cn } from "@/components/ui";
import type { EntrantJSON, TournamentJSON } from "@/lib/types";
import { computeStandings } from "@/lib/engine";
import { pointsForPosition } from "@/lib/ranking-points";
import { formatLabel } from "@/lib/i18n/formats";
import { PadelMark } from "@/components/Logo";
import { AutoRefresh } from "@/components/public/AutoRefresh";
import { ScoreForm } from "@/components/public/ScoreForm";
import { StandingsTable, medalFor } from "@/components/public/StandingsTable";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // fall through
  }
  return fallback;
}

/** Simplified two-way plural: exact singular vs. a shared "other" form. */
function pluralSuffix(count: number, locale: "en" | "pl", en: string, pl: string): string {
  if (count === 1) return "";
  return locale === "pl" ? pl : en;
}

function sideNames(ids: string[], map: Record<string, EntrantJSON>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const e = map[id];
    if (!e) continue;
    if (e.players && e.players.length > 0) out.push(...e.players);
    else out.push(e.name);
  }
  return out;
}

export function PresentView({
  tournament,
  clubId,
}: {
  tournament: TournamentJSON;
  clubId: string;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();

  const map: Record<string, EntrantJSON> = {};
  for (const e of tournament.entrants) map[e.id] = e;

  const isActive = tournament.status === "active";
  const round = tournament.rounds[tournament.rounds.length - 1] ?? null;
  const allScored =
    round?.matches.every((m) => m.scoreA != null && m.scoreB != null) ?? false;
  const standings = computeStandings(tournament.entrants, tournament.rounds);
  const podium = standings.slice(0, 3);

  const [rankingOpen, setRankingOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [advancing, setAdvancing] = useState<"next" | "final" | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  // A fullscreen kiosk shouldn't let the page behind it scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  async function advance(final: boolean) {
    setAdvancing(final ? "final" : "next");
    setAdvanceError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final }),
      });
      if (!res.ok) {
        setAdvanceError(
          await readApiError(res, t("common.requestFailed", { status: res.status }))
        );
        return;
      }
      router.refresh();
    } catch {
      setAdvanceError(t("common.networkError"));
    } finally {
      setAdvancing(null);
    }
  }

  async function closeTournament() {
    setClosing(true);
    setCloseError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        setCloseError(
          await readApiError(res, t("common.requestFailed", { status: res.status }))
        );
        return;
      }
      setCloseOpen(false);
      router.refresh();
    } catch {
      setCloseError(t("common.networkError"));
    } finally {
      setClosing(false);
    }
  }

  const missingCount = round?.matches.filter((m) => m.scoreA == null).length ?? 0;
  const controlHref = `/manager/tournaments/${tournament._id}?club=${clubId}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-navy-950">
      <AutoRefresh enabled={isActive} intervalMs={12000} />

      {/* Decorative background glow, matching the landing page's aesthetic */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1100px 560px at 12% -10%, rgba(217,249,84,0.09), transparent 60%), radial-gradient(900px 520px at 105% 15%, rgba(47,125,225,0.14), transparent 55%)",
        }}
      />

      {/* Top bar */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-white/10 bg-navy-950/90 px-5 py-4 backdrop-blur-md sm:px-8">
        <PadelMark size={34} />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold text-white sm:text-xl">
            {tournament.name}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-volt-300">
            {isActive ? (
              <>
                {t("present.badge")} · {t("control.round", { number: round?.number })}
              </>
            ) : (
              t("courtPage.finishedTitle")
            )}
            {round?.isFinal && isActive && (
              <Badge tone="volt" className="align-middle normal-case tracking-normal">
                {t("control.finalBadge")}
              </Badge>
            )}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => setRankingOpen(true)}>
            🏆 {t("present.rankingButton")}
          </Button>
          <Button
            variant="ghost"
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex"
          >
            {isFullscreen ? t("present.exitFullscreen") : t("present.fullscreen")}
          </Button>
          <Link
            href={controlHref}
            className="btn btn-ghost"
            aria-label={t("present.exit")}
            title={t("present.exit")}
          >
            ✕
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative flex flex-1 flex-col px-5 py-8 pb-72 sm:px-8 sm:pb-44">
        {/* Faint watermark for texture without distracting from scores */}
        <PadelMark size={420} className="pointer-events-none absolute -bottom-24 -right-24 opacity-[0.03]" />
        {!isActive ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-12 text-center">
            <PadelMark size={64} />
            <div>
              <h2 className="text-3xl font-extrabold text-white">
                {t("courtPage.finishedTitle")}
              </h2>
              <p className="mt-2 text-sm text-slate-400">{t("present.finishedSubtitle")}</p>
            </div>
            {podium.length >= 2 && (
              <div className="grid w-full gap-4 sm:grid-cols-3">
                {[1, 0, 2].map((idx) => {
                  const row = podium[idx];
                  if (!row) return <div key={idx} className="hidden sm:block" />;
                  const position = idx + 1;
                  return (
                    <div
                      key={row.entrantId}
                      className={cn(
                        "card card-pad text-center",
                        position === 1 && "border-volt-400/40 sm:-mt-3"
                      )}
                    >
                      <span className="text-3xl">{["🥇", "🥈", "🥉"][position - 1]}</span>
                      <h3 className="mt-2 text-lg font-extrabold text-white">{row.name}</h3>
                      <p className="mt-1 text-2xl font-extrabold text-volt-300">
                        {row.points}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Link href={`/t/${tournament._id}/results`} className="btn btn-primary btn-lg">
                {t("courtPage.seeResults")}
              </Link>
              <Link href={controlHref} className="btn btn-secondary btn-lg">
                {t("present.backToControl")}
              </Link>
            </div>
          </div>
        ) : (
          round && (
            <div className="relative m-auto w-full max-w-6xl">
              <div className="grid gap-6 xl:grid-cols-2">
                {round.matches.map((match) => {
                  const done = match.scoreA != null && match.scoreB != null;
                  const aNames = sideNames(match.sideA, map);
                  const bNames = sideNames(match.sideB, map);
                  return (
                    <div
                      key={match.court}
                      className={cn(
                        "card card-pad relative overflow-hidden",
                        done
                          ? "border-volt-400/25"
                          : "border-ocean-400/30 shadow-[0_0_0_1px_rgba(74,168,255,0.08)]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-xl font-extrabold uppercase tracking-wide text-volt-300 sm:text-2xl">
                          {match.court}
                        </h2>
                        {done ? (
                          <Badge tone="volt">{t("control.played")}</Badge>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-ocean-400">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-ocean-400" />
                            {t("present.liveIndicator")}
                          </span>
                        )}
                      </div>

                      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
                        <div className="text-right">
                          {aNames.map((n) => (
                            <p key={n} className="text-lg font-bold text-white sm:text-xl">
                              {n}
                            </p>
                          ))}
                        </div>
                        <div className="text-center">
                          {done ? (
                            <p className="text-4xl font-extrabold text-volt-300 sm:text-5xl">
                              {match.scoreA}
                              <span className="mx-1.5 text-slate-600">:</span>
                              {match.scoreB}
                            </p>
                          ) : (
                            <span className="text-sm font-bold text-slate-500">
                              {t("courtPage.vs")}
                            </span>
                          )}
                        </div>
                        <div>
                          {bNames.map((n) => (
                            <p key={n} className="text-lg font-bold text-white sm:text-xl">
                              {n}
                            </p>
                          ))}
                        </div>
                      </div>

                      {!done && (
                        <div className="mt-6 border-t border-white/5 pt-6">
                          <ScoreForm
                            tournamentId={tournament._id}
                            roundNumber={round.number}
                            court={match.court}
                            matchPoints={tournament.matchPoints}
                            size="xl"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {round.byes.length > 0 && (
                <p className="mt-6 text-center text-sm text-slate-400">
                  {t("control.restingList", {
                    names: round.byes.map((id) => map[id]?.name ?? id).join(", "),
                  })}
                </p>
              )}
            </div>
          )
        )}
      </main>

      {/* Bottom action bar */}
      {isActive && round && (
        <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-navy-950/95 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
            {!round.isFinal ? (
              <>
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => advance(false)}
                  disabled={!allScored || advancing !== null}
                >
                  {advancing === "next" && <Spinner className="h-4 w-4" />}
                  {t("control.startRound", { number: round.number + 1 })}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => advance(true)}
                  disabled={!allScored || advancing !== null}
                >
                  {advancing === "final" && <Spinner className="h-4 w-4" />}
                  {t("control.playFinal")}
                </Button>
              </>
            ) : (
              <p className="text-sm font-semibold text-volt-300">
                {t("control.finalInPlay")}
              </p>
            )}
            <Button
              size="lg"
              variant="danger"
              className="w-full sm:ml-auto sm:w-auto"
              onClick={() => {
                setCloseError(null);
                setCloseOpen(true);
              }}
            >
              {t("control.closeTournament")}
            </Button>
          </div>
          {!allScored && !round.isFinal && (
            <p className="mx-auto mt-2 max-w-6xl text-xs text-slate-500">
              {t("control.waitingFor", {
                count: missingCount,
                plural: pluralSuffix(missingCount, locale, "s", "y"),
                round: round.number,
              })}
            </p>
          )}
          <div className="mx-auto max-w-6xl">
            <ErrorText>{advanceError}</ErrorText>
          </div>
        </footer>
      )}

      {/* Ranking popup */}
      {rankingOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center sm:p-8"
          onClick={() => setRankingOpen(false)}
        >
          <div
            className="card w-full max-w-2xl bg-navy-850 p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-extrabold text-white">
                🏆 {t("present.rankingTitle")}
              </h2>
              <button
                onClick={() => setRankingOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label={t("common.close")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-xs uppercase tracking-wider text-slate-500">
              <Badge tone="blue">{formatLabel(t, tournament.type)}</Badge>
            </p>
            <StandingsTable standings={standings} t={t} />
            {standings.length > 0 && medalFor(1) && (
              <p className="mt-4 text-center text-xs text-slate-500">
                {standings[0].name} · {standings[0].points} {t("home.pointsLabel")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Close confirmation */}
      <Modal
        open={closeOpen}
        onClose={() => !closing && setCloseOpen(false)}
        title={t("control.closeModalTitle")}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCloseOpen(false)}
              disabled={closing}
            >
              {t("control.keepPlaying")}
            </Button>
            <Button variant="danger" onClick={closeTournament} disabled={closing}>
              {closing && <Spinner className="h-3.5 w-3.5" />}
              {t("control.closeAndAward")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {t("control.closeModalBody", {
            gold: pointsForPosition(1),
            silver: pointsForPosition(2),
            bronze: pointsForPosition(10),
            rest: pointsForPosition(11),
          })}
        </p>
        {isActive && round && !allScored && (
          <p className="mt-3 text-sm font-medium text-amber-400">
            {t("control.closeModalWarning", { round: round.number })}
          </p>
        )}
        <ErrorText>{closeError}</ErrorText>
      </Modal>
    </div>
  );
}
