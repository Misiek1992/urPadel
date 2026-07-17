"use client";

// Manager control board for a tournament: enter/edit scores for any round,
// advance to the next or final round, close the tournament, delete it.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Badge,
  Button,
  ErrorText,
  Modal,
  Spinner,
  cn,
} from "@/components/ui";
import type { EntrantJSON, TournamentJSON } from "@/lib/types";
import { pointsForPosition } from "@/lib/ranking-points";
import { ScoreForm } from "@/components/public/ScoreForm";
import { Collapsible } from "@/components/public/Collapsible";
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

function names(ids: string[], map: Record<string, EntrantJSON>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const e = map[id];
    if (!e) continue;
    if (e.players && e.players.length > 0) out.push(...e.players);
    else out.push(e.name);
  }
  return out;
}

/** Simplified two-way plural: exact singular vs. a shared "other" form. */
function pluralSuffix(count: number, locale: "en" | "pl", en: string, pl: string): string {
  if (count === 1) return "";
  return locale === "pl" ? pl : en;
}

export function TournamentControl({
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
  const pastRounds = tournament.rounds.filter((r) => r !== round);
  const allScored =
    round?.matches.every((m) => m.scoreA != null && m.scoreB != null) ?? false;

  const [advancing, setAdvancing] = useState<"next" | "final" | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingPast, setEditingPast] = useState<string | null>(null);

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
        setAdvanceError(await readApiError(res, t("common.requestFailed", { status: res.status })));
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
        setCloseError(await readApiError(res, t("common.requestFailed", { status: res.status })));
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

  async function deleteTournament() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError(await readApiError(res, t("common.requestFailed", { status: res.status })));
        return;
      }
      router.push(`/manager?club=${clubId}`);
    } catch {
      setDeleteError(t("common.networkError"));
      setDeleting(false);
    }
  }

  const missingCount = round?.matches.filter((m) => m.scoreA == null).length ?? 0;

  return (
    <div className="space-y-8">
      {/* Action bar */}
      {isActive && round && (
        <div className="card card-pad">
          <div className="flex flex-wrap items-center gap-3">
            {!round.isFinal ? (
              <>
                <Button
                  onClick={() => advance(false)}
                  disabled={!allScored || advancing !== null}
                >
                  {advancing === "next" && <Spinner className="h-3.5 w-3.5" />}
                  {t("control.startRound", { number: round.number + 1 })}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => advance(true)}
                  disabled={!allScored || advancing !== null}
                >
                  {advancing === "final" && <Spinner className="h-3.5 w-3.5" />}
                  {t("control.playFinal")}
                </Button>
              </>
            ) : (
              <p className="text-sm font-semibold text-volt-300">
                {t("control.finalInPlay")}
              </p>
            )}
            <Button
              variant="danger"
              className="ml-auto"
              onClick={() => {
                setCloseError(null);
                setCloseOpen(true);
              }}
            >
              {t("control.closeTournament")}
            </Button>
          </div>
          {!allScored && !round.isFinal && (
            <p className="mt-2 text-xs text-slate-500">
              {t("control.waitingFor", {
                count: missingCount,
                plural: pluralSuffix(missingCount, locale, "s", "y"),
                round: round.number,
              })}
            </p>
          )}
          <ErrorText>{advanceError}</ErrorText>
        </div>
      )}

      {/* Current round with score entry */}
      {isActive && round && (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="section-title">
              {t("control.round", { number: round.number })}
              {round.isFinal && (
                <Badge tone="volt" className="ml-2 align-middle">
                  {t("control.finalBadge")}
                </Badge>
              )}
            </h2>
            <span className="text-xs text-slate-500">
              {t("control.courtScreens")}{" "}
              {tournament.courts.map((c, i) => (
                <span key={c}>
                  {i > 0 && " · "}
                  <Link
                    href={`/t/${tournament._id}/court/${encodeURIComponent(c)}`}
                    className="font-semibold text-volt-300 hover:text-volt-400"
                    target="_blank"
                  >
                    {c}
                  </Link>
                </span>
              ))}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {round.matches.map((match) => {
              const done = match.scoreA != null && match.scoreB != null;
              return (
                <div key={match.court} className="card card-pad">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-volt-300">
                      {match.court}
                    </h3>
                    {done && <Badge tone="volt">{t("control.played")}</Badge>}
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                    <div className="text-right">
                      {names(match.sideA, map).map((n) => (
                        <p key={n} className="font-semibold text-white">{n}</p>
                      ))}
                    </div>
                    <span
                      className={cn(
                        "text-lg font-extrabold",
                        done ? "text-volt-300" : "text-slate-600"
                      )}
                    >
                      {done ? `${match.scoreA}:${match.scoreB}` : "vs"}
                    </span>
                    <div>
                      {names(match.sideB, map).map((n) => (
                        <p key={n} className="font-semibold text-white">{n}</p>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <ScoreForm
                      tournamentId={tournament._id}
                      roundNumber={round.number}
                      court={match.court}
                      matchPoints={tournament.matchPoints}
                      initialScoreA={match.scoreA}
                      initialScoreB={match.scoreB}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {round.byes.length > 0 && (
            <p className="mt-4 text-sm text-slate-400">
              <span className="badge badge-slate mr-2">{t("control.resting")}</span>
              {round.byes.map((id) => map[id]?.name ?? id).join(", ")}
            </p>
          )}
        </section>
      )}

      {/* Past rounds, editable */}
      {pastRounds.length > 0 && (
        <section>
          <h2 className="section-title mb-4">
            {isActive ? t("control.previousRounds") : t("control.allRounds")}
            <span className="ml-2 align-middle text-xs font-normal text-slate-500">
              {isActive ? t("control.previousHint") : t("control.lockedHint")}
            </span>
          </h2>
          <div className="space-y-3">
            {[...pastRounds].reverse().map((r) => (
              <Collapsible
                key={r.number}
                title={
                  r.isFinal
                    ? `${t("control.round", { number: r.number })} — ${t("control.finalBadge")}`
                    : t("control.round", { number: r.number })
                }
                meta={
                  <span className="text-xs text-slate-500">
                    {r.matches.length}
                  </span>
                }
              >
                <div className="space-y-3">
                  {r.matches.map((m) => {
                    const editKey = `${r.number}|${m.court}`;
                    const isEditing = editingPast === editKey;
                    return (
                      <div
                        key={m.court}
                        className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="w-24 text-xs font-bold uppercase tracking-wide text-slate-400">
                            {m.court}
                          </span>
                          <span className="font-medium text-white">
                            {names(m.sideA, map).join(" & ")}
                          </span>
                          <span className="font-extrabold text-volt-300">
                            {m.scoreA != null ? `${m.scoreA}:${m.scoreB}` : "—"}
                          </span>
                          <span className="font-medium text-white">
                            {names(m.sideB, map).join(" & ")}
                          </span>
                          {isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto"
                              onClick={() =>
                                setEditingPast(isEditing ? null : editKey)
                              }
                            >
                              {isEditing ? t("control.cancel") : t("control.edit")}
                            </Button>
                          )}
                        </div>
                        {isEditing && (
                          <div className="mt-3 border-t border-white/5 pt-3">
                            <ScoreForm
                              tournamentId={tournament._id}
                              roundNumber={r.number}
                              court={m.court}
                              matchPoints={tournament.matchPoints}
                              initialScoreA={m.scoreA}
                              initialScoreB={m.scoreB}
                              onSaved={() => setEditingPast(null)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {r.byes.length > 0 && (
                    <p className="text-xs text-slate-500">
                      {t("control.restingList", {
                        names: r.byes.map((id) => map[id]?.name ?? id).join(", "),
                      })}
                    </p>
                  )}
                </div>
              </Collapsible>
            ))}
          </div>
        </section>
      )}

      {/* Danger zone */}
      <section className="card card-pad border-red-500/20">
        <h2 className="text-sm font-bold text-red-300">{t("control.dangerZoneTitle")}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-400">
            {tournament.pointsAwarded
              ? t("control.dangerZoneHintAwarded")
              : t("control.dangerZoneHintNotAwarded")}
          </p>
          <Button
            variant="danger"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setDeleteArmed(false);
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            {t("control.deleteTournament")}
          </Button>
        </div>
      </section>

      {/* Close modal */}
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

      {/* Delete modal (double confirm) */}
      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title={t("control.deleteModalTitle", { name: tournament.name })}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              {t("common.cancel")}
            </Button>
            {!deleteArmed ? (
              <Button variant="danger" onClick={() => setDeleteArmed(true)}>
                {t("control.confirmDelete")}
              </Button>
            ) : (
              <Button variant="danger" onClick={deleteTournament} disabled={deleting}>
                {deleting && <Spinner className="h-3.5 w-3.5" />}
                {t("control.deletePermanently")}
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {t("control.deleteModalBody", {
            name: tournament.name,
            awarded: tournament.pointsAwarded
              ? t("control.deleteModalAwardedSuffix")
              : "",
          })}
        </p>
        <ErrorText>{deleteError}</ErrorText>
      </Modal>
    </div>
  );
}
