"use client";

// Connect/disconnect this club's Playtomic Third-Party API credentials.
// The secret is never echoed back by the server (src/lib/types.ts
// sanitizeClub) — the input always starts blank, and leaving it blank on a
// later save reuses whatever's already stored.

import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Modal, Spinner } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";
import type { ClubJSON } from "@/lib/types";

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // fall through
  }
  return fallback;
}

export function PlaytomicSettings({
  clubId,
  club,
}: {
  clubId: string;
  club: ClubJSON;
}) {
  const t = useT();
  const [clientId, setClientId] = useState(club.playtomicClientId ?? "");
  const [tenantId, setTenantId] = useState(club.playtomicTenantId ?? "");
  const [secret, setSecret] = useState("");
  const [connected, setConnected] = useState(Boolean(club.playtomicClientId));
  const [connectedAt, setConnectedAt] = useState(club.playtomicConnectedAt ?? null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/playtomic`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          tenantId: tenantId.trim(),
          secret: secret.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res, t("common.requestFailed", { status: res.status })));
        return;
      }
      const data = (await res.json()) as { club: ClubJSON };
      setConnected(true);
      setConnectedAt(data.club.playtomicConnectedAt ?? null);
      setClientId(data.club.playtomicClientId ?? clientId);
      setTenantId(data.club.playtomicTenantId ?? tenantId);
      setSecret("");
      setSuccess(t("playtomic.saveSuccess"));
    } catch {
      setError(t("common.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/playtomic`, { method: "DELETE" });
      if (!res.ok) {
        setError(await readApiError(res, t("common.requestFailed", { status: res.status })));
        return;
      }
      setConnected(false);
      setConnectedAt(null);
      setClientId("");
      setTenantId("");
      setSecret("");
      setSuccess(t("playtomic.disconnectSuccess"));
      setConfirmDisconnect(false);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{t("playtomic.settingsTitle")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("playtomic.settingsHint")}</p>
        </div>
        <p className="text-sm font-semibold">
          {connected ? (
            <span className="text-volt-300">
              {t("playtomic.connectedAs", { clientId })}
              {connectedAt && (
                <span className="ml-1 font-normal text-slate-500">
                  {t("playtomic.connectedSince", {
                    date: new Date(connectedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }),
                  })}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-500">{t("playtomic.notConnected")}</span>
          )}
        </p>
      </div>

      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t("playtomic.clientIdLabel")}</label>
          <Input value={clientId} onChange={(e) => setClientId(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t("playtomic.tenantIdLabel")}</label>
          <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
          <p className="mt-1 text-xs text-slate-500">{t("playtomic.tenantIdHint")}</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">{t("playtomic.secretLabel")}</label>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t("playtomic.secretPlaceholder")}
            autoComplete="off"
          />
          {connected && (
            <p className="mt-1 text-xs text-slate-500">{t("playtomic.secretHintExisting")}</p>
          )}
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {saving ? t("playtomic.saving") : t("playtomic.saveButton")}
          </Button>
          {connected && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmDisconnect(true)}
              disabled={saving}
            >
              {t("playtomic.disconnectButton")}
            </Button>
          )}
        </div>
      </form>
      {success && <p className="mt-3 text-sm font-medium text-emerald-400">{success}</p>}
      <ErrorText>{error}</ErrorText>

      <Modal
        open={confirmDisconnect}
        onClose={() => !disconnecting && setConfirmDisconnect(false)}
        title={t("playtomic.disconnectConfirmTitle")}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDisconnect(false)}
              disabled={disconnecting}
            >
              {t("playtomic.cancel")}
            </Button>
            <Button variant="danger" onClick={disconnect} disabled={disconnecting}>
              {disconnecting && <Spinner className="h-3.5 w-3.5" />}
              {t("playtomic.disconnectConfirmButton")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">{t("playtomic.disconnectConfirmHint")}</p>
      </Modal>
    </Card>
  );
}
