// Bridges the engine's TournamentType with translated labels/descriptions.
// engine.ts's own TOURNAMENT_TYPES stays English-only (used for internal
// validation and English-language audit log messages); UI code should use
// these helpers instead whenever it renders format names to a viewer.
import type { TournamentType } from "@/lib/engine";
import type { Translator } from "./index";

const DICT_KEY: Record<TournamentType, string> = {
  americano: "americano",
  mexicano: "mexicano",
  "americano-team": "americanoTeam",
  "mexicano-team": "mexicanoTeam",
};

export function formatLabel(t: Translator, type: TournamentType): string {
  return t(`formats.${DICT_KEY[type]}Label`);
}

export function formatDescription(t: Translator, type: TournamentType): string {
  return t(`formats.${DICT_KEY[type]}Description`);
}

const ALL_TYPES: TournamentType[] = [
  "americano",
  "mexicano",
  "americano-team",
  "mexicano-team",
];

export function formatOptions(
  t: Translator
): { value: TournamentType; label: string; description: string }[] {
  return ALL_TYPES.map((value) => ({
    value,
    label: formatLabel(t, value),
    description: formatDescription(t, value),
  }));
}
