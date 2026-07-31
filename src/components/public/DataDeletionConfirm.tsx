"use client";

// Landing for the emailed confirmation link. The link only navigates here
// (a GET) — it never deletes on its own, so email prefetchers / security
// scanners that auto-open links can't trigger the deletion. The actual
// erasure runs only when the user presses the button (a POST).

import { useState } from "react";
import { Button, ErrorText, Spinner } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";

export function DataDeletionConfirm({ token }: { token: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ players: number; rankingEntries: number } | null>(null);

  if (!token) {
    return (
      <p className="text-sm font-medium text-red-400">{t("dataDeletion.invalidToken")}</p>
    );
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/data-deletion/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => null)) as
        | { deleted?: { players: number; rankingEntries: number }; error?: string; code?: string }
        | null;
      if (!res.ok || !data?.deleted) {
        setError(
          data?.code === "invalid_token"
            ? t("dataDeletion.invalidToken")
            : data?.error ?? t("common.requestFailed", { status: res.status })
        );
        return;
      }
      setDone(data.deleted);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-volt-400/20 bg-volt-400/[0.06] p-5 text-sm text-slate-200">
        <p className="font-semibold text-volt-300">{t("dataDeletion.doneTitle")}</p>
        <p className="mt-1 text-slate-300">
          {t("dataDeletion.doneBody", {
            players: done.players,
            entries: done.rankingEntries,
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">{t("dataDeletion.confirmWarning")}</p>
      <Button variant="danger" onClick={confirm} disabled={busy}>
        {busy && <Spinner className="h-3.5 w-3.5" />}
        {t("dataDeletion.confirmButton")}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
