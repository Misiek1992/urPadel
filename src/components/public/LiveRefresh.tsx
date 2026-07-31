"use client";

// Change-aware live refresh for the public tournament page. The old approach
// (AutoRefresh) blindly called router.refresh() every 10s per open device,
// re-running the ENTIRE server tree — including the root layout's SiteHeader
// auth/DB queries — even when nothing had changed, which during a quiet
// stretch of a tournament is most ticks.
//
// Instead: poll the lightweight `GET /api/tournaments/[id]` JSON and only
// refresh the tree when the tournament's `updatedAt` actually advanced (it
// bumps on every score write / round advance / close, since those all go
// through Mongoose `updateOne` with timestamps). The server render stays
// authoritative for every section (podium, collapsible past rounds, byes,
// i18n) — we just stop paying for it when there's nothing new to show.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({
  tournamentId,
  initialUpdatedAt,
  enabled = true,
  intervalMs = 10000,
}: {
  tournamentId: string;
  initialUpdatedAt: string;
  enabled?: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const baseline = useRef(initialUpdatedAt);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { tournament?: { updatedAt?: string } };
        const next = data.tournament?.updatedAt;
        if (next && next !== baseline.current) {
          baseline.current = next;
          router.refresh();
        }
      } catch {
        // Transient network hiccup — the next tick retries.
      }
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, intervalMs, tournamentId, router]);

  return null;
}
