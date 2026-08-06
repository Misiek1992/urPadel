// Orchestrator for a competitive tournament's live view. Picks the right
// layout per format and threads shared props. Server-safe (embeds the client
// TieScoreForm only when `editable`). Pass an already-hydrated tournament
// (ties resolved) — the read paths do this via hydrateCompetitive.
import type { TournamentJSON } from "@/lib/types";
import type { Translator } from "@/lib/i18n";
import { entrantMap } from "@/components/public/helpers";
import { BracketView } from "./BracketView";
import { GroupTables } from "./GroupTables";
import { LeagueView } from "./LeagueView";
import { tiesById } from "./helpers";

export function CompetitiveView({
  tournament,
  t,
  editable = false,
}: {
  tournament: TournamentJSON;
  t: Translator;
  editable?: boolean;
}) {
  const scoring = tournament.scoring ?? "points";
  const bestOfSets = tournament.config?.bestOfSets ?? 3;
  const ties = tournament.ties ?? [];
  const byId = tiesById(ties);
  const map = entrantMap(tournament.entrants);
  const shared = { byId, map, tournamentId: tournament._id, scoring, bestOfSets, editable, t };

  if (tournament.type === "league-team") {
    return <LeagueView ties={ties} entrants={tournament.entrants} {...shared} />;
  }

  if (tournament.type === "knockout-team") {
    return (
      <section>
        <h2 className="section-title mb-4">{t("competitive.bracket")}</h2>
        <BracketView ties={ties} {...shared} />
      </section>
    );
  }

  if (tournament.type === "groups-team") {
    const hasKnockout = ties.some((x) => x.stage === "knockout" || x.stage === "playin");
    return (
      <div className="space-y-10">
        <section>
          <h2 className="section-title mb-4">{t("competitive.groupStage")}</h2>
          <GroupTables
            groups={tournament.groups ?? []}
            ties={ties}
            entrants={tournament.entrants}
            advancePerGroup={tournament.config?.advancePerGroup ?? 2}
            {...shared}
          />
        </section>
        {hasKnockout && (
          <section>
            <h2 className="section-title mb-4">{t("competitive.knockoutStage")}</h2>
            <BracketView ties={ties} {...shared} />
          </section>
        )}
      </div>
    );
  }

  return null;
}
