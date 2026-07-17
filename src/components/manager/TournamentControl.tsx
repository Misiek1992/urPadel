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
import { ScoreForm } from "@/components/public/ScoreForm";
import { Collapsible } from "@/components/public/Collapsible";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`;
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

export function TournamentControl({
  tournament,
  clubId,
}: {
  tournament: TournamentJSON;
  clubId: string;
}) {
  const router = useRouter();
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
        setAdvanceError(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      setAdvanceError("Network error — please try again.");
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
        setCloseError(await readApiError(res));
        return;
      }
      setCloseOpen(false);
      router.refresh();
    } catch {
      setCloseError("Network error — please try again.");
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
        setDeleteError(await readApiError(res));
        return;
      }
      router.push(`/manager?club=${clubId}`);
    } catch {
      setDeleteError("Network error — please try again.");
      setDeleting(false);
    }
  }

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
                  Start round {round.number + 1} →
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => advance(true)}
                  disabled={!allScored || advancing !== null}
                >
                  {advancing === "final" && <Spinner className="h-3.5 w-3.5" />}
                  🏁 Play FINAL round (1st & 2nd vs 3rd & 4th)
                </Button>
              </>
            ) : (
              <p className="text-sm font-semibold text-volt-300">
                Final round in play — close the tournament when all scores are in.
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
              Close tournament
            </Button>
          </div>
          {!allScored && !round.isFinal && (
            <p className="mt-2 text-xs text-slate-500">
              Waiting for{" "}
              {round.matches.filter((m) => m.scoreA == null).length} more result
              {round.matches.filter((m) => m.scoreA == null).length === 1 ? "" : "s"}{" "}
              in round {round.number} before the next round can start.
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
              Round {round.number}
              {round.isFinal && (
                <Badge tone="volt" className="ml-2 align-middle">
                  FINAL — seeded by ranking
                </Badge>
              )}
            </h2>
            <span className="text-xs text-slate-500">
              Court screens:{" "}
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
                    {done && <Badge tone="volt">Played</Badge>}
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
              <span className="badge badge-slate mr-2">Resting</span>
              {round.byes.map((id) => map[id]?.name ?? id).join(", ")}
            </p>
          )}
        </section>
      )}

      {/* Past rounds, editable */}
      {pastRounds.length > 0 && (
        <section>
          <h2 className="section-title mb-4">
            {isActive ? "Previous rounds" : "All rounds"}
            <span className="ml-2 align-middle text-xs font-normal text-slate-500">
              {isActive
                ? "managers can correct any result"
                : "finished — results are locked"}
            </span>
          </h2>
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
                              {isEditing ? "Cancel" : "Edit"}
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
                      Resting: {r.byes.map((id) => map[id]?.name ?? id).join(", ")}
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
        <h2 className="text-sm font-bold text-red-300">Danger zone</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-400">
            Delete this tournament{" "}
            {tournament.pointsAwarded
              ? "and take back the ranking points it awarded."
              : "— no ranking points have been awarded yet."}
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
            Delete tournament
          </Button>
        </div>
      </section>

      {/* Close modal */}
      <Modal
        open={closeOpen}
        onClose={() => !closing && setCloseOpen(false)}
        title="Close the tournament?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCloseOpen(false)}
              disabled={closing}
            >
              Keep playing
            </Button>
            <Button variant="danger" onClick={closeTournament} disabled={closing}>
              {closing && <Spinner className="h-3.5 w-3.5" />}
              Close & award points
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Closing locks all results and awards club ranking points by final
          position: <span className="font-bold text-volt-300">100</span> for 1st,{" "}
          <span className="font-bold text-volt-300">90</span> for 2nd … {" "}
          <span className="font-bold text-volt-300">10</span> for 10th, and{" "}
          <span className="font-bold text-volt-300">1</span> participation point
          for everyone else. Points count towards the ranking for one year.
        </p>
        {isActive && round && !allScored && (
          <p className="mt-3 text-sm font-medium text-amber-400">
            Round {round.number} still has unentered results — those matches simply
            won't count.
          </p>
        )}
        <ErrorText>{closeError}</ErrorText>
      </Modal>

      {/* Delete modal (double confirm) */}
      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title={`Delete ${tournament.name}?`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            {!deleteArmed ? (
              <Button variant="danger" onClick={() => setDeleteArmed(true)}>
                Yes, I want to delete it
              </Button>
            ) : (
              <Button variant="danger" onClick={deleteTournament} disabled={deleting}>
                {deleting && <Spinner className="h-3.5 w-3.5" />}
                Delete permanently
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm text-slate-300">
          All rounds and results of{" "}
          <span className="font-semibold text-white">{tournament.name}</span> will
          be permanently deleted
          {tournament.pointsAwarded &&
            ", and the ranking points it awarded will be removed"}
          . This cannot be undone.
        </p>
        <ErrorText>{deleteError}</ErrorText>
      </Modal>
    </div>
  );
}
