"use client";

// Ranking management: expandable per-player entry lists with point editing,
// entry deletion and manual adjustments.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
  cn,
} from "@/components/ui";
import type {
  ClubPlayerJSON,
  RankingEntryJSON,
  RankingRowJSON,
} from "@/lib/types";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingManager({
  clubId,
  rows,
  roster,
}: {
  clubId: string;
  rows: RankingRowJSON[];
  roster: ClubPlayerJSON[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Adjustment form
  const [adjPlayer, setAdjPlayer] = useState("");
  const [adjCustom, setAdjCustom] = useState("");
  const [adjPoints, setAdjPoints] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjBusy, setAdjBusy] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);
  const [adjDone, setAdjDone] = useState<string | null>(null);

  // Entry edit / delete
  const [editEntry, setEditEntry] = useState<RankingEntryJSON | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<RankingEntryJSON | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function submitAdjustment(e: FormEvent) {
    e.preventDefault();
    const playerName = adjPlayer === "__custom__" ? adjCustom.trim() : adjPlayer;
    const points = Number(adjPoints);
    if (!playerName) {
      setAdjError("Pick or enter a player name.");
      return;
    }
    if (!Number.isInteger(points) || points === 0) {
      setAdjError("Points must be a non-zero whole number (negatives allowed).");
      return;
    }
    setAdjBusy(true);
    setAdjError(null);
    setAdjDone(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/ranking/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName,
          points,
          note: adjNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setAdjError(await readApiError(res));
        return;
      }
      setAdjDone(
        `Adjusted ${playerName} by ${points > 0 ? "+" : ""}${points} points.`
      );
      setAdjPlayer("");
      setAdjCustom("");
      setAdjPoints("");
      setAdjNote("");
      router.refresh();
    } catch {
      setAdjError("Network error — please try again.");
    } finally {
      setAdjBusy(false);
    }
  }

  function openEdit(entry: RankingEntryJSON) {
    setEditEntry(entry);
    setEditPoints(String(entry.points));
    setEditNote(entry.note ?? "");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editEntry) return;
    const points = Number(editPoints);
    if (!Number.isInteger(points)) {
      setEditError("Points must be a whole number.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/ranking-entries/${editEntry._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, note: editNote.trim() }),
      });
      if (!res.ok) {
        setEditError(await readApiError(res));
        return;
      }
      setEditEntry(null);
      router.refresh();
    } catch {
      setEditError("Network error — please try again.");
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteEntry) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/ranking-entries/${deleteEntry._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError(await readApiError(res));
        return;
      }
      setDeleteEntry(null);
      router.refresh();
    } catch {
      setDeleteError("Network error — please try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        {rows.length === 0 ? (
          <EmptyState
            title="No ranking points yet"
            hint="Close a tournament (or add a manual adjustment) and the ranking appears here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Player</th>
                  <th className="text-right">Points</th>
                  <th className="text-right">Tournaments</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const key = row.playerName.toLowerCase();
                  const isOpen = expanded === key;
                  return [
                    <tr
                      key={key}
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
                        {MEDALS[row.position - 1] ?? row.position}
                      </td>
                      <td className="font-semibold text-white">{row.playerName}</td>
                      <td className="text-right text-base font-extrabold text-volt-300">
                        {row.total}
                      </td>
                      <td className="text-right text-slate-400">
                        {row.tournamentsPlayed}
                      </td>
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(isOpen ? null : key)}
                        >
                          {isOpen ? "Hide" : "Entries"}
                        </Button>
                      </td>
                    </tr>,
                    isOpen ? (
                      <tr key={`${key}-detail`}>
                        <td colSpan={5} className="bg-white/[0.02] px-4 py-3">
                          <div className="space-y-1.5">
                            {row.entries.map((entry) => (
                              <div
                                key={entry._id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]"
                              >
                                <span className="w-24 text-xs text-slate-500">
                                  {new Date(entry.date).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                <Badge
                                  tone={entry.kind === "tournament" ? "blue" : "slate"}
                                >
                                  {entry.kind === "tournament"
                                    ? `${entry.position ? `#${entry.position} · ` : ""}${
                                        entry.tournamentName ?? "Tournament"
                                      }`
                                    : "Manual adjustment"}
                                </Badge>
                                {entry.note && (
                                  <span className="text-xs italic text-slate-400">
                                    {entry.note}
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "ml-auto font-bold",
                                    entry.points >= 0
                                      ? "text-volt-300"
                                      : "text-red-400"
                                  )}
                                >
                                  {entry.points > 0 ? `+${entry.points}` : entry.points}
                                </span>
                                <span className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEdit(entry)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300"
                                    onClick={() => {
                                      setDeleteError(null);
                                      setDeleteEntry(entry);
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <Card>
          <h3 className="section-title">Add adjustment</h3>
          <p className="mt-1 text-sm text-slate-400">
            Manually grant or remove points — bonuses, corrections, penalties.
          </p>
          <form onSubmit={submitAdjustment} className="mt-4 space-y-3">
            <div>
              <label className="label">Player</label>
              <Select
                value={adjPlayer}
                onChange={(e) => setAdjPlayer(e.target.value)}
              >
                <option value="">Choose a player…</option>
                {roster.map((p) => (
                  <option key={p._id} value={p.name}>
                    {p.name}
                  </option>
                ))}
                <option value="__custom__">Other (type a name)</option>
              </Select>
            </div>
            {adjPlayer === "__custom__" && (
              <Input
                value={adjCustom}
                onChange={(e) => setAdjCustom(e.target.value)}
                placeholder="Player name"
                aria-label="Custom player name"
              />
            )}
            <div>
              <label className="label">Points (± allowed)</label>
              <Input
                type="number"
                value={adjPoints}
                onChange={(e) => setAdjPoints(e.target.value)}
                placeholder="e.g. 25 or -10"
              />
            </div>
            <div>
              <label className="label">Note</label>
              <Textarea
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                rows={2}
                placeholder="Why? (shown in the entry list)"
              />
            </div>
            <Button type="submit" disabled={adjBusy} className="w-full">
              {adjBusy && <Spinner className="h-3.5 w-3.5" />}
              Add adjustment
            </Button>
            <ErrorText>{adjError}</ErrorText>
            {adjDone && (
              <p className="text-sm font-medium text-emerald-400">{adjDone}</p>
            )}
          </form>
        </Card>
      </div>

      <Modal
        open={editEntry !== null}
        onClose={() => !editBusy && setEditEntry(null)}
        title={`Edit entry — ${editEntry?.playerName}`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditEntry(null)}
              disabled={editBusy}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editBusy}>
              {editBusy && <Spinner className="h-3.5 w-3.5" />}
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            {editEntry?.kind === "tournament"
              ? `Awarded for ${editEntry.tournamentName ?? "a tournament"}${
                  editEntry.position ? ` (position ${editEntry.position})` : ""
                }.`
              : "Manual adjustment."}
          </p>
          <div>
            <label className="label">Points</label>
            <Input
              type="number"
              value={editPoints}
              onChange={(e) => setEditPoints(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Note</label>
            <Input
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <ErrorText>{editError}</ErrorText>
        </div>
      </Modal>

      <Modal
        open={deleteEntry !== null}
        onClose={() => !deleteBusy && setDeleteEntry(null)}
        title="Delete ranking entry?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteEntry(null)}
              disabled={deleteBusy}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy && <Spinner className="h-3.5 w-3.5" />}
              Delete entry
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Removes{" "}
          <span className="font-semibold text-white">
            {deleteEntry && (deleteEntry.points > 0 ? "+" : "")}
            {deleteEntry?.points} points
          </span>{" "}
          for{" "}
          <span className="font-semibold text-white">{deleteEntry?.playerName}</span>
          {deleteEntry?.tournamentName ? ` (${deleteEntry.tournamentName})` : ""}. The
          ranking recalculates immediately.
        </p>
        <ErrorText>{deleteError}</ErrorText>
      </Modal>
    </div>
  );
}
