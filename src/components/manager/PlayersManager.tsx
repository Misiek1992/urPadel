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
import { useT } from "@/components/i18n/LocaleProvider";

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // fall through
  }
  return fallback;
}

export function PlayersManager({
  clubId,
  players,
}: {
  clubId: string;
  players: ClubPlayerJSON[];
}) {
  const router = useRouter();
  const t = useT();
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
      setAddError(t("managerPlayers.nameRequired"));
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
        setAddError(await readApiError(res, t("common.requestFailed", { status: res.status })));
        return;
      }
      setNewName("");
      setNewEmail("");
      router.refresh();
    } catch {
      setAddError(t("common.networkError"));
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
        setImportError(await readApiError(res, t("common.requestFailed", { status: res.status })));
        return;
      }
      setImportDone(t("managerPlayers.importDone", { count: parsedNew.length }));
      setImportText("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setImportError(t("common.networkError"));
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
        setEditError(await readApiError(res, t("common.requestFailed", { status: res.status })));
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setEditError(t("common.networkError"));
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
        setDeleteError(await readApiError(res, t("common.requestFailed", { status: res.status })));
        return;
      }
      setDeleting(null);
      router.refresh();
    } catch {
      setDeleteError(t("common.networkError"));
    } finally {
      setDeleteBusy(false);
    }
  }

  const [bulkHintBefore, bulkHintAfter] = t("managerPlayers.bulkHint").split("{bold}");

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {players.length === 0 ? (
          <EmptyState
            title={t("managerPlayers.noPlayersTitle")}
            hint={t("managerPlayers.noPlayersHint")}
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t("managerPlayers.player")}</th>
                  <th>{t("managerPlayers.email")}</th>
                  <th>{t("managerPlayers.added")}</th>
                  <th className="text-right">{t("managerPlayers.actions")}</th>
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
                        {t("managerPlayers.edit")}
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
                        {t("managerPlayers.delete")}
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
          <h3 className="section-title">{t("managerPlayers.addTitle")}</h3>
          <form onSubmit={addPlayer} className="mt-4 space-y-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("managerPlayers.namePlaceholder")}
              aria-label={t("managerPlayers.namePlaceholder")}
            />
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("managerPlayers.emailPlaceholder")}
              aria-label={t("managerPlayers.emailPlaceholder")}
            />
            <Button type="submit" disabled={adding} className="w-full">
              {adding && <Spinner className="h-3.5 w-3.5" />}
              {t("managerPlayers.addToRoster")}
            </Button>
            <ErrorText>{addError}</ErrorText>
          </form>
        </Card>

        <Card>
          <h3 className="section-title">{t("managerPlayers.bulkTitle")}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {bulkHintBefore}
            <span className="font-semibold text-slate-300">
              {t("managerPlayers.bulkHintBold")}
            </span>
            {bulkHintAfter}
          </p>
          <div className="mt-4 space-y-3">
            <Textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportDone(null);
              }}
              rows={5}
              placeholder={t("managerPlayers.importTextPlaceholder")}
              aria-label={t("managerPlayers.bulkTitle")}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
              aria-label={t("managerPlayers.bulkTitle")}
            />
            {parsed.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-semibold text-slate-300">
                  {t("managerPlayers.foundNames", {
                    count: parsed.length,
                    new: parsedNew.length,
                  })}
                  {parsed.length - parsedNew.length > 0 && (
                    <span className="text-slate-500">
                      {t("managerPlayers.alreadyInRoster", {
                        count: parsed.length - parsedNew.length,
                      })}
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
              {parsedNew.length === 1
                ? t("managerPlayers.addNPlayers", { count: parsedNew.length })
                : t("managerPlayers.addNPlayersPlural", { count: parsedNew.length })}
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
        title={t("managerPlayers.editModalTitle")}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditing(null)}
              disabled={editSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving && <Spinner className="h-3.5 w-3.5" />}
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">{t("managerPlayers.nameLabel")}</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("managerPlayers.emailLabel")}</label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder={t("common.optional")}
            />
          </div>
          <ErrorText>{editError}</ErrorText>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => !deleteBusy && setDeleting(null)}
        title={t("managerPlayers.deleteModalTitle", { name: deleting?.name ?? "" })}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleting(null)}
              disabled={deleteBusy}
            >
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy && <Spinner className="h-3.5 w-3.5" />}
              {t("managerPlayers.removePlayer")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {t("managerPlayers.deleteModalHint", { name: deleting?.name ?? "" })}
        </p>
        <ErrorText>{deleteError}</ErrorText>
      </Modal>
    </div>
  );
}
