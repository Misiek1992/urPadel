"use client";

// Invisible helper that re-fetches the current server-rendered route on an
// interval so live tournament data stays fresh without user interaction.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({
  intervalMs = 10000,
  enabled = true,
}: {
  intervalMs?: number;
  enabled?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
