"use client";

// Public data-deletion request form: enter an email, we send a confirmation
// link. Deliberately vague on success ("if that address has data…") so it
// never reveals whether an address is in the system.

import { useState, type FormEvent } from "react";
import { Button, ErrorText, Input, Spinner } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";

export function DataDeletionForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/data-deletion/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? t("common.requestFailed", { status: res.status }));
        return;
      }
      setSent(true);
    } catch {
      setError(t("common.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-volt-400/20 bg-volt-400/[0.06] p-5 text-sm text-slate-200">
        <p className="font-semibold text-volt-300">{t("dataDeletion.sentTitle")}</p>
        <p className="mt-1 text-slate-300">{t("dataDeletion.sentBody", { email: email.trim() })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="deletion-email">
          {t("dataDeletion.emailLabel")}
        </label>
        <Input
          id="deletion-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("dataDeletion.emailPlaceholder")}
          autoComplete="email"
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting && <Spinner className="h-3.5 w-3.5" />}
        {t("dataDeletion.requestButton")}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
