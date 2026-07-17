"use client";

// Score entry for a single match. Entering side A auto-fills side B with
// (matchPoints - A) until the user edits B manually. Posts to the public
// result endpoint; the server enforces who may set or edit which scores.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorText, Input, Spinner, cn } from "@/components/ui";

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
  size?: "md" | "lg";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [scoreA, setScoreA] = useState(
    initialScoreA != null ? String(initialScoreA) : ""
  );
  const [scoreB, setScoreB] = useState(
    initialScoreB != null ? String(initialScoreB) : ""
  );
  const [bTouched, setBTouched] = useState(initialScoreB != null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("Enter whole numbers of 0 or more.");
      return;
    }
    if (a + b !== matchPoints) {
      setError(`Scores must add up to ${matchPoints} (currently ${a + b}).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundNumber, court, scoreA: a, scoreB: b }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `Request failed (${res.status})`);
        return;
      }
      onSaved?.();
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const big = size === "lg";
  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex items-center justify-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={matchPoints}
          value={scoreA}
          onChange={(e) => handleA(e.target.value)}
          aria-label="Side A score"
          className={cn(
            "text-center font-bold",
            big ? "h-16 w-24 text-3xl" : "w-16"
          )}
        />
        <span className={cn("font-bold text-slate-500", big ? "text-2xl" : "text-sm")}>
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
          className={cn(
            "text-center font-bold",
            big ? "h-16 w-24 text-3xl" : "w-16"
          )}
        />
        <Button
          type="submit"
          disabled={saving}
          size={big ? "lg" : "sm"}
          className="ml-2"
        >
          {saving && <Spinner className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
      <p className={cn("mt-1.5 text-center text-slate-500", big ? "text-sm" : "text-xs")}>
        Rally points — must add up to {matchPoints}
      </p>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
