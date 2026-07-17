"use client";

// Roster management: add, edit, delete players plus bulk import from
// Playtomic exports / CSV / plain text (parsed entirely client-side).

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Input,
  Modal,
  Spinner,
  Textarea,
} from "@/components/ui";
import type { ClubPlayerJSON } from "@/lib/types";
import { parsePlayersText } from "@/lib/players-import";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`;
}

export function PlayersManager({
  clubId,
  players,
}: {
  clubId: string;
  players: ClubPlayerJSON[];
}) {
  const router = useRouter();
  const rosterLower = useMemo(
    () => new Set(players.map((p) => p.nameLower)),
    [players]
  );

  // Single add
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Bulk import
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit / delete
  const [editing, setEditing] = useState<ClubPlayerJSON | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ClubPlayerJSON | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePlayersText(importText), [importText]);
  const parsedNew = parsed.filter((n) => !rosterLower.has(n.toLowerCase()));

  async function addPlayer(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setAddError("Enter a player name.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setAddError(await readApiError(res));
        return;
      }
      setNewName("");
      setNewEmail("");
      router.refresh();
    } catch {
      setAddError("Network error — please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    setImportDone(null);
  }

  async function runImport() {
    if (parsedNew.length === 0) return;
    setImporting(true);
    setImportError(null);
    setImportDone(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: parsedNew }),
      });
      if (!res.ok) {
        setImportError(await readApiError(res));
        return;
      }
      setImportDone(`Added ${parsedNew.length} players to the roster.`);
      setImportText("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setImportError("Network error — please try again.");
    } finally {
      setImporting(false);
    }
  }

  function openEdit(player: ClubPlayerJSON) {
    setEditing(player);
    setEditName(player.name);
    setEditEmail(player.email ?? "");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/players/${editing._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      if (!res.ok) {
        setEditError(await readApiError(res));
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setEditError("Network error — please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/players/${deleting._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError(await readApiError(res));
        return;
      }
      setDeleting(null);
      router.refresh();
    } catch {
      setDeleteError("Network error — please try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {players.length === 0 ? (
          <EmptyState
            title="No players in the roster yet"
            hint="Add players one by one or import a whole list from Playtomic / CSV on the right."
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Email</th>
                  <th>Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p._id}>
                    <td className="font-semibold text-white">{p.name}</td>
                    <td className="text-slate-400">{p.email || "—"}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(p);
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <h3 className="section-title">Add a player</h3>
          <form onSubmit={addPlayer} className="mt-4 space-y-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name"
              aria-label="Player name"
            />
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email (optional)"
              aria-label="Player email"
            />
            <Button type="submit" disabled={adding} className="w-full">
              {adding && <Spinner className="h-3.5 w-3.5" />}
              Add to roster
            </Button>
            <ErrorText>{addError}</ErrorText>
          </form>
        </Card>

        <Card>
          <h3 className="section-title">Bulk import</h3>
          <p className="mt-1 text-sm text-slate-400">
            Paste a player list or upload a{" "}
            <span className="font-semibold text-slate-300">
              Playtomic export, CSV or text file
            </span>{" "}
            — one player per line; header rows are detected automatically.
          </p>
          <div className="mt-4 space-y-3">
            <Textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportDone(null);
              }}
              rows={5}
              placeholder={"Adam Kowalski\nMaria Nowak\n…"}
              aria-label="Players to import"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
              aria-label="Upload player file"
            />
            {parsed.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-semibold text-slate-300">
                  Found {parsed.length} names ·{" "}
                  <span className="text-volt-300">{parsedNew.length} new</span>
                  {parsed.length - parsedNew.length > 0 && (
                    <span className="text-slate-500">
                      {" "}
                      · {parsed.length - parsedNew.length} already in roster
                    </span>
                  )}
                </p>
                <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                  {parsed.map((name) => (
                    <Badge
                      key={name}
                      tone={rosterLower.has(name.toLowerCase()) ? "slate" : "volt"}
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={runImport}
              disabled={importing || parsedNew.length === 0}
              className="w-full"
            >
              {importing && <Spinner className="h-3.5 w-3.5" />}
              Add {parsedNew.length} new player{parsedNew.length === 1 ? "" : "s"}
            </Button>
            <ErrorText>{importError}</ErrorText>
            {importDone && (
              <p className="text-sm font-medium text-emerald-400">{importDone}</p>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => !editSaving && setEditing(null)}
        title="Edit player"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditing(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving && <Spinner className="h-3.5 w-3.5" />}
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <ErrorText>{editError}</ErrorText>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => !deleteBusy && setDeleting(null)}
        title={`Remove ${deleting?.name}?`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleting(null)}
              disabled={deleteBusy}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy && <Spinner className="h-3.5 w-3.5" />}
              Remove player
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          This removes{" "}
          <span className="font-semibold text-white">{deleting?.name}</span> from
          the roster. Their past tournament results and ranking points are kept.
        </p>
        <ErrorText>{deleteError}</ErrorText>
      </Modal>
    </div>
  );
}
