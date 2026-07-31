"use client";

// "Import from Playtomic" button + modal: lists the club's Playtomic
// tournaments (last 7 days to next 30) with checkboxes, then either hands
// off a single selection to the New Tournament wizard (via sessionStorage —
// the same cross-page hand-off ScoreForm.tsx already uses for the score PIN)
// or bulk-imports players from multiple selections straight into the roster.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, EmptyState, ErrorText, Modal, Spinner } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";

interface PlaytomicPlayer {
  name: string;
  email?: string;
}
interface PlaytomicTournament {
  activityId: string;
  name: string;
  date: string;
  players: PlaytomicPlayer[];
}

function importStorageKey(clubId: string): string {
  return `urpadel:playtomic-import:${clubId}`;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // fall through
  }
  return fallback;
}

export function PlaytomicImportButton({
  clubId,
  connected,
}: {
  clubId: string;
  connected: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<PlaytomicTournament[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setLoadError(null);
    setImportError(null);
    setTournaments(null);
    setChecked(new Set());
    setLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/playtomic/tournaments`);
      if (!res.ok) {
        setLoadError(await readApiError(res, t("playtomic.importLoadError")));
        return;
      }
      const data = (await res.json()) as { tournaments: PlaytomicTournament[] };
      setTournaments(data.tournaments);
    } catch {
      setLoadError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  function toggle(activityId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  async function doImport() {
    if (!tournaments) return;
    const selected = tournaments.filter((tour) => checked.has(tour.activityId));
    if (selected.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/playtomic/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournaments: selected.map((tour) => ({ name: tour.name, players: tour.players })),
        }),
      });
      if (!res.ok) {
        setImportError(await readApiError(res, t("playtomic.importError")));
        return;
      }
      const data = (await res.json()) as {
        tournaments: { name: string; playerNames: string[] }[];
        newPlayers: number;
      };

      if (data.tournaments.length === 1) {
        sessionStorage.setItem(
          importStorageKey(clubId),
          JSON.stringify({
            name: data.tournaments[0].name,
            players: data.tournaments[0].playerNames,
          })
        );
        setOpen(false);
        router.push(`/manager/tournaments/new?club=${clubId}`);
        return;
      }

      setToast(
        t(
          data.newPlayers === 1
            ? "playtomic.importSuccessMultiple"
            : "playtomic.importSuccessMultiplePlural",
          { players: data.newPlayers, count: data.tournaments.length }
        )
      );
      setOpen(false);
    } catch {
      setImportError(t("common.networkError"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={openModal}
        disabled={!connected}
        title={connected ? undefined : t("managerDashboard.importDisabledHint")}
      >
        {t("managerDashboard.importFromPlaytomic")}
      </Button>
      {toast && <p className="mt-2 text-sm font-medium text-emerald-400">{toast}</p>}

      <Modal
        open={open}
        onClose={() => !importing && setOpen(false)}
        title={t("playtomic.importModalTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={importing}>
              {t("playtomic.cancel")}
            </Button>
            <Button onClick={doImport} disabled={importing || checked.size === 0}>
              {importing && <Spinner className="h-3.5 w-3.5" />}
              {importing
                ? t("playtomic.importing")
                : t("playtomic.importSelected", { count: checked.size })}
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-400">{t("playtomic.importModalHint")}</p>
        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
            <Spinner className="h-4 w-4" />
            {t("playtomic.importLoading")}
          </div>
        )}
        <ErrorText>{loadError}</ErrorText>
        {!loading && !loadError && tournaments && tournaments.length === 0 && (
          <EmptyState
            title={t("playtomic.importEmptyTitle")}
            hint={t("playtomic.importEmptyHint")}
          />
        )}
        {!loading && tournaments && tournaments.length > 0 && (
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {tournaments.map((tour) => {
              const isChecked = checked.has(tour.activityId);
              return (
                <label
                  key={tour.activityId}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(tour.activityId)}
                    className="h-4 w-4 accent-[#d9f954]"
                  />
                  <span className="flex-1">
                    <span
                      className={isChecked ? "font-semibold text-white" : "text-slate-300"}
                    >
                      {tour.name}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {new Date(tour.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {t(
                      tour.players.length === 1
                        ? "playtomic.importPlayersCount"
                        : "playtomic.importPlayersCountPlural",
                      { count: tour.players.length }
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <ErrorText>{importError}</ErrorText>
      </Modal>
    </>
  );
}
