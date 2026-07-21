"use client";

// Score entry for a single match. Entering side A auto-fills side B with
// (matchPoints - A) until the user edits B manually. Posts to the public
// result endpoint; the server enforces who may set or edit which scores.

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, ErrorText, Input, Spinner, cn } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";

function pinStorageKey(tournamentId: string): string {
  return `urpadel:pin:${tournamentId}`;
}

export function ScoreForm({
  tournamentId,
  roundNumber,
  court,
  matchPoints,
  initialScoreA,
  initialScoreB,
  size = "md",
  onSaved,
}: {
  tournamentId: string;
  roundNumber: number;
  court: string;
  matchPoints: number;
  initialScoreA?: number | null;
  initialScoreB?: number | null;
  size?: "md" | "lg" | "xl";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const t = useT();
  const [scoreA, setScoreA] = useState(
    initialScoreA != null ? String(initialScoreA) : ""
  );
  const [scoreB, setScoreB] = useState(
    initialScoreB != null ? String(initialScoreB) : ""
  );
  const [bTouched, setBTouched] = useState(initialScoreB != null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinRequired, setPinRequired] = useState(false);

  useEffect(() => {
    const remembered = sessionStorage.getItem(pinStorageKey(tournamentId));
    if (remembered) setPin(remembered);
  }, [tournamentId]);

  function handleA(value: string) {
    setScoreA(value);
    const a = Number(value);
    if (!bTouched && value !== "" && Number.isInteger(a) && a >= 0 && a <= matchPoints) {
      setScoreB(String(matchPoints - a));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      setError(t("scoreForm.invalidNumbers"));
      return;
    }
    if (a + b !== matchPoints) {
      setError(t("scoreForm.sumMismatch", { points: matchPoints, sum: a + b }));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber,
          court,
          scoreA: a,
          scoreB: b,
          pin: pin || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;
        if (data?.code === "pin_required" || data?.code === "pin_invalid") {
          setPinRequired(true);
          setError(
            data.code === "pin_invalid"
              ? t("scoreForm.pinInvalid")
              : t("scoreForm.pinRequired")
          );
          return;
        }
        setError(data?.error ?? t("common.requestFailed", { status: res.status }));
        return;
      }
      if (pinRequired && pin) {
        sessionStorage.setItem(pinStorageKey(tournamentId), pin);
      }
      onSaved?.();
      router.refresh();
    } catch {
      setError(t("scoreForm.networkError"));
    } finally {
      setSaving(false);
    }
  }

  const xl = size === "xl";
  const big = size === "lg" || xl;
  // Hide the number-input spin buttons — they eat horizontal space and are
  // useless on touch kiosks, where these inputs must fit two big digits.
  const noSpin =
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const sizeClasses = xl
    ? "h-24 w-40 border-2 border-white/25 bg-white/10 px-1 text-6xl focus:border-volt-400"
    : big
      ? "h-16 w-28 px-1 text-3xl"
      : "w-16 px-1";
  return (
    <form onSubmit={submit} className="w-full">
      <div className={cn("flex items-center justify-center", xl ? "gap-4" : "gap-2")}>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={matchPoints}
          value={scoreA}
          onChange={(e) => handleA(e.target.value)}
          aria-label="Side A score"
          className={cn("text-center font-bold", noSpin, sizeClasses)}
        />
        <span
          className={cn(
            "font-bold text-slate-500",
            xl ? "text-4xl" : big ? "text-2xl" : "text-sm"
          )}
        >
          :
        </span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={matchPoints}
          value={scoreB}
          onChange={(e) => {
            setBTouched(true);
            setScoreB(e.target.value);
          }}
          aria-label="Side B score"
          className={cn("text-center font-bold", noSpin, sizeClasses)}
        />
        <Button
          type="submit"
          disabled={saving}
          size={big ? "lg" : "sm"}
          className={cn(xl ? "ml-4" : "ml-2")}
        >
          {saving && <Spinner className={xl ? "h-5 w-5" : "h-3.5 w-3.5"} />}
          {t("scoreForm.save")}
        </Button>
      </div>
      {pinRequired && (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <label
            htmlFor={`pin-${tournamentId}-${court}`}
            className={cn("font-semibold text-slate-300", xl ? "text-base" : "text-xs")}
          >
            {t("scoreForm.pinLabel")}
          </label>
          <Input
            id={`pin-${tournamentId}-${court}`}
            type="text"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={t("scoreForm.pinPlaceholder")}
            className={cn("text-center font-bold tracking-widest", xl ? "w-32 text-2xl" : "w-24")}
            autoFocus
          />
        </div>
      )}
      <p
        className={cn(
          "mt-1.5 text-center text-slate-500",
          xl ? "text-base" : big ? "text-sm" : "text-xs"
        )}
      >
        {t("scoreForm.hint", { points: matchPoints })}
      </p>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
