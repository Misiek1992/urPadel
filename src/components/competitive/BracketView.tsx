// Knockout bracket as horizontally-scrolling columns: play-in (if any), then
// each round to the final, plus a third-place playoff. Server-safe.
import type { EntrantJSON, ScoringMode, TieJSON } from "@/lib/types";
import type { Translator } from "@/lib/i18n";
import { TieCard } from "./TieCard";

export function BracketView({
  ties,
  byId,
  map,
  tournamentId,
  scoring,
  bestOfSets,
  editable,
  t,
}: {
  ties: TieJSON[];
  byId: Record<string, TieJSON>;
  map: Record<string, EntrantJSON>;
  tournamentId: string;
  scoring: ScoringMode;
  bestOfSets: number;
  editable: boolean;
  t: Translator;
}) {
  const playin = ties.filter((x) => x.stage === "playin");
  const knockout = ties.filter((x) => x.stage === "knockout" && x.id !== "ko-3rd");
  const third = ties.find((x) => x.id === "ko-3rd");
  const rounds = [...new Set(knockout.map((x) => x.round))].sort((a, b) => a - b);

  const columns: { key: string; header: string; ties: TieJSON[] }[] = [];
  if (playin.length) columns.push({ key: "playin", header: t("competitive.playIn"), ties: playin });
  for (const r of rounds) {
    const roundTies = knockout.filter((x) => x.round === r);
    columns.push({ key: `r${r}`, header: roundTies[0]?.label ?? t("competitive.round", { n: r }), ties: roundTies });
  }
  if (third) columns.push({ key: "third", header: t("competitive.thirdPlace"), ties: [third] });

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {columns.map((col) => (
          <div key={col.key} className="flex w-56 flex-col">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              {col.header}
            </h4>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {col.ties.map((tie) => (
                <TieCard
                  key={tie.id}
                  tie={tie}
                  byId={byId}
                  map={map}
                  tournamentId={tournamentId}
                  scoring={scoring}
                  bestOfSets={bestOfSets}
                  editable={editable}
                  t={t}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
