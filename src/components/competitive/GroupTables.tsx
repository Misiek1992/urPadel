// Group stage: one standings table per group (qualifying places highlighted)
// plus that group's fixtures for score entry. Server-safe.
import type { EntrantJSON, GroupJSON, ScoringMode, TieJSON } from "@/lib/types";
import type { Entrant } from "@/lib/engine";
import type { Translator } from "@/lib/i18n";
import { groupTable } from "@/lib/competitive";
import { StandingsTable } from "@/components/public/StandingsTable";
import { TieCard } from "./TieCard";

export function GroupTables({
  groups,
  ties,
  entrants,
  byId,
  map,
  tournamentId,
  scoring,
  bestOfSets,
  advancePerGroup,
  editable,
  t,
}: {
  groups: GroupJSON[];
  ties: TieJSON[];
  entrants: EntrantJSON[];
  byId: Record<string, TieJSON>;
  map: Record<string, EntrantJSON>;
  tournamentId: string;
  scoring: ScoringMode;
  bestOfSets: number;
  advancePerGroup: number;
  editable: boolean;
  t: Translator;
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const table = groupTable(group, ties, entrants as Entrant[], scoring);
        const fixtures = ties.filter((x) => x.stage === "group" && x.group === group.label);
        return (
          <div key={group.label} className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title">{t("competitive.groupLabel", { group: group.label })}</h3>
              <span className="text-xs text-slate-500">
                {t("competitive.advancesNote", { n: advancePerGroup })}
              </span>
            </div>
            <StandingsTable standings={table} t={t} />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {fixtures.map((tie) => (
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
        );
      })}
    </div>
  );
}
