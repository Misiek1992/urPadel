// One competitive tie: two sides plus its score, an entry form (when editable
// and ready), or a waiting state. Server-safe — embeds the client TieScoreForm
// only when editable. Used by the bracket, group fixtures and league fixtures.
import type { EntrantJSON, ScoringMode, TieJSON } from "@/lib/types";
import type { Translator } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui";
import { TieScoreForm } from "./TieScoreForm";
import { isByeSide, scoreText, sideLabel, tieState } from "./helpers";

export function TieCard({
  tie,
  byId,
  map,
  tournamentId,
  scoring,
  bestOfSets,
  editable,
  t,
  className,
}: {
  tie: TieJSON;
  byId: Record<string, TieJSON>;
  map: Record<string, EntrantJSON>;
  tournamentId: string;
  scoring: ScoringMode;
  bestOfSets: number;
  editable: boolean;
  t: Translator;
  className?: string;
}) {
  const state = tieState(tie, scoring);
  const score = scoreText(tie, scoring);

  function SideRow({ side }: { side: "A" | "B" }) {
    const s = side === "A" ? tie.sideA : tie.sideB;
    const isWinner = tie.winner === side;
    const isLoser = tie.winner != null && tie.winner !== side;
    const bye = isByeSide(s);
    return (
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "truncate text-sm",
            bye
              ? "italic text-slate-500"
              : isWinner
                ? "font-bold text-white"
                : isLoser
                  ? "text-slate-400"
                  : s.entrantId
                    ? "font-semibold text-slate-100"
                    : "italic text-slate-500"
          )}
        >
          {sideLabel(s, byId, map, t)}
        </span>
        {isWinner && <span className="shrink-0 text-volt-300">✓</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.02] px-3 py-2.5",
        state === "playable" ? "border-volt-400/30" : "border-white/8",
        className
      )}
    >
      {(tie.label || (tie.court && state === "playable")) && (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {tie.label}
          </span>
          {state === "playable" && tie.court && <Badge tone="blue">{tie.court}</Badge>}
          {state === "decided" && !isByeTie(tie) && (
            <Badge tone="volt">{t("competitive.played")}</Badge>
          )}
        </div>
      )}
      <div className="space-y-1">
        <SideRow side="A" />
        <SideRow side="B" />
      </div>

      {state === "decided" && score && (
        <p className="mt-2 text-center text-lg font-extrabold text-volt-300">{score}</p>
      )}
      {state === "playable" && editable && (
        <div className="mt-2 border-t border-white/5 pt-2">
          <TieScoreForm
            tournamentId={tournamentId}
            tieId={tie.id}
            scoring={scoring}
            bestOfSets={bestOfSets}
          />
        </div>
      )}
      {state === "playable" && !editable && (
        <p className="mt-2 text-center text-xs font-semibold text-slate-500">
          {t("competitive.vs")}
        </p>
      )}
      {state === "pending" && (
        <p className="mt-2 text-center text-[11px] italic text-slate-600">
          {t("competitive.awaiting")}
        </p>
      )}
    </div>
  );
}

function isByeTie(tie: TieJSON): boolean {
  return isByeSide(tie.sideA) || isByeSide(tie.sideB);
}
