// Live standings table shared by tournament, court and club pages.
// Pure props — safe in server and client components.

import type { StandingRow } from "@/lib/engine";
import { cn } from "@/lib/cn";

const MEDALS = ["🥇", "🥈", "🥉"];

export function medalFor(position: number): string | null {
  return MEDALS[position - 1] ?? null;
}

export function StandingsTable({
  standings,
  limit,
  showRecord = true,
}: {
  standings: StandingRow[];
  limit?: number;
  showRecord?: boolean;
}) {
  const rows = limit ? standings.slice(0, limit) : standings;
  return (
    <div className="table-wrap">
      <table className="table-base">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th>Player</th>
            <th className="text-right">Points</th>
            {showRecord && (
              <>
                <th className="text-right">W–D–L</th>
                <th className="text-right">+/−</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const position = i + 1;
            const medal = medalFor(position);
            return (
              <tr
                key={row.entrantId}
                className={cn(position <= 3 && "bg-volt-400/[0.04]")}
              >
                <td
                  className={cn(
                    "font-bold",
                    position === 1
                      ? "text-volt-300"
                      : position === 2
                        ? "text-slate-300"
                        : position === 3
                          ? "text-amber-600"
                          : "text-slate-500"
                  )}
                >
                  {medal ?? position}
                </td>
                <td>
                  <span className="font-semibold text-white">{row.name}</span>
                  {row.players && row.players.length > 0 && (
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {row.players.join(" · ")}
                    </span>
                  )}
                </td>
                <td className="text-right text-base font-extrabold text-volt-300">
                  {row.points}
                </td>
                {showRecord && (
                  <>
                    <td className="text-right text-xs text-slate-400">
                      {row.wins}–{row.draws}–{row.losses}
                    </td>
                    <td
                      className={cn(
                        "text-right text-xs font-semibold",
                        row.diff > 0
                          ? "text-emerald-400"
                          : row.diff < 0
                            ? "text-red-400"
                            : "text-slate-500"
                      )}
                    >
                      {row.diff > 0 ? `+${row.diff}` : row.diff}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
