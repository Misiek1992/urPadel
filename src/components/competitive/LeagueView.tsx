// League: the table plus all fixtures grouped by round, for score entry.
// Server-safe.
import type { EntrantJSON, ScoringMode, TieJSON } from "@/lib/types";
import type { Entrant } from "@/lib/engine";
import type { Translator } from "@/lib/i18n";
import { leagueTable } from "@/lib/competitive";
import { StandingsTable } from "@/components/public/StandingsTable";
import { TieCard } from "./TieCard";

export function LeagueView({
  ties,
  entrants,
  byId,
  map,
  tournamentId,
  scoring,
  bestOfSets,
  editable,
  t,
}: {
  ties: TieJSON[];
  entrants: EntrantJSON[];
  byId: Record<string, TieJSON>;
  map: Record<string, EntrantJSON>;
  tournamentId: string;
  scoring: ScoringMode;
  bestOfSets: number;
  editable: boolean;
  t: Translator;
}) {
  const table = leagueTable(entrants as Entrant[], ties, scoring);
  const league = ties.filter((x) => x.stage === "league");
  const rounds = [...new Set(league.map((x) => x.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="section-title mb-4">{t("competitive.leagueTable")}</h2>
        <StandingsTable standings={table} t={t} />
      </section>
      <section>
        <h2 className="section-title mb-4">{t("competitive.fixtures")}</h2>
        <div className="space-y-4">
          {rounds.map((r) => (
            <div key={r}>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                {t("competitive.round", { n: r })}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {league
                  .filter((x) => x.round === r)
                  .map((tie) => (
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
      </section>
    </div>
  );
}
