"use client";

// Score entry for a single competitive tie. Supports both scoring modes:
//   points — one number per side, higher wins.
//   sets   — games per set (add up to best-of sets).
// Posts to the public /tie-result endpoint; the server re-validates and drives
// advancement. Mirrors ScoreForm's PIN/session plumbing.

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, ErrorText, Input, Spinner, cn } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";
import type { ScoringMode, TieScoreJSON } from "@/lib/types";

function pinStorageKey(tournamentId: string): string {
  return `urpadel:pin:${tournamentId}`;
}

export function TieScoreForm({
  tournamentId,
  tieId,
  scoring,
  bestOfSets = 3,
  size = "md",
  onSaved,
}: {
  tournamentId: string;
  tieId: string;
  scoring: ScoringMode;
  bestOfSets?: number;
  size?: "md" | "xl";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const t = useT();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [sets, setSets] = useState<{ a: string; b: string }[]>([{ a: "", b: "" }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinRequired, setPinRequired] = useState(false);

  useEffect(() => {
    const remembered = sessionStorage.getItem(pinStorageKey(tournamentId));
    if (remembered) setPin(remembered);
  }, [tournamentId]);

  function buildScore(): TieScoreJSON | null {
    if (scoring === "sets") {
      const parsed: { a: number; b: number }[] = [];
      for (const s of sets) {
        if (s.a === "" && s.b === "") continue;
        const ga = Number(s.a);
        const gb = Number(s.b);
        if (!Number.isInteger(ga) || !Number.isInteger(gb) || ga < 0 || gb < 0) return null;
        if (ga === gb) return null;
        parsed.push({ a: ga, b: gb });
      }
      if (parsed.length === 0) return null;
      let wa = 0;
      let wb = 0;
      for (const s of parsed) s.a > s.b ? wa++ : wb++;
      if (wa === wb) return null; // no overall winner
      return { sets: parsed };
    }
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0) return null;
    if (na === nb) return null;
    return { a: na, b: nb };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const score = buildScore();
    if (!score) {
      setError(scoring === "sets" ? t("competitive.matchWinnerNeeded") : t("competitive.invalidScore"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/tie-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tieId, score, pin: pin || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
        if (data?.code === "pin_required" || data?.code === "pin_invalid") {
          setPinRequired(true);
          setError(data.code === "pin_invalid" ? t("competitive.pinInvalid") : t("competitive.pinRequired"));
          return;
        }
        setError(data?.error ?? t("common.requestFailed", { status: res.status }));
        return;
      }
      if (pinRequired && pin) sessionStorage.setItem(pinStorageKey(tournamentId), pin);
      setSaved(true);
      onSaved?.();
      router.refresh();
    } catch {
      setError(t("competitive.networkError"));
    } finally {
      setSaving(false);
    }
  }

  const xl = size === "xl";
  const noSpin =
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const cell = xl ? "h-20 w-28 text-5xl" : "h-11 w-16 text-xl";

  return (
    <form onSubmit={submit} className="w-full">
      {scoring === "sets" ? (
        <div className={cn("space-y-2", xl && "space-y-3")}>
          {sets.map((s, i) => (
            <div key={i} className="flex items-center justify-center gap-2">
              <span className={cn("text-slate-500", xl ? "text-lg" : "text-xs")}>
                {t("competitive.setLabel", { n: i + 1 })}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={s.a}
                onChange={(e) =>
                  setSets((prev) => prev.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))
                }
                aria-label={`Set ${i + 1} side A games`}
                className={cn("text-center font-bold", noSpin, cell)}
              />
              <span className="font-bold text-slate-500">-</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={s.b}
                onChange={(e) =>
                  setSets((prev) => prev.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))
                }
                aria-label={`Set ${i + 1} side B games`}
                className={cn("text-center font-bold", noSpin, cell)}
              />
            </div>
          ))}
          {sets.length < bestOfSets && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSets((prev) => [...prev, { a: "", b: "" }])}
            >
              {t("competitive.addSet")}
            </Button>
          )}
          <p className={cn("text-center text-slate-500", xl ? "text-base" : "text-xs")}>
            {t("competitive.setsHint", { n: bestOfSets })}
          </p>
        </div>
      ) : (
        <div className={cn("flex items-center justify-center", xl ? "gap-4" : "gap-2")}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={a}
            onChange={(e) => setA(e.target.value)}
            aria-label="Side A score"
            className={cn("text-center font-bold", noSpin, cell)}
          />
          <span className={cn("font-bold text-slate-500", xl ? "text-4xl" : "text-lg")}>:</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={b}
            onChange={(e) => setB(e.target.value)}
            aria-label="Side B score"
            className={cn("text-center font-bold", noSpin, cell)}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-center">
        <Button
          type="submit"
          disabled={saving || saved}
          size={xl ? "lg" : "sm"}
          className={cn(saved && "!bg-emerald-500 !text-white")}
        >
          {saving && <Spinner className={xl ? "h-5 w-5" : "h-3.5 w-3.5"} />}
          {saved ? t("competitive.saved") : t("competitive.save")}
        </Button>
      </div>

      {pinRequired && (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <label
            htmlFor={`pin-${tournamentId}-${tieId}`}
            className={cn("font-semibold text-slate-300", xl ? "text-base" : "text-xs")}
          >
            {t("competitive.pinLabel")}
          </label>
          <Input
            id={`pin-${tournamentId}-${tieId}`}
            type="text"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={t("competitive.pinPlaceholder")}
            className={cn("text-center font-bold tracking-widest", xl ? "w-32 text-2xl" : "w-24")}
            autoFocus
          />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
