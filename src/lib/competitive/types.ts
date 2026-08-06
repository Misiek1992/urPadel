// The minimal tournament shape the competitive engine operates on. Both the
// Mongoose document (via serialize) and a freshly-built structure conform to
// it, so resolve/placement/isComplete work on either.
import type {
  CompetitiveConfigJSON,
  GroupJSON,
  ScoringMode,
  TieJSON,
  TournamentType,
} from "@/lib/types";
import type { Entrant } from "@/lib/engine";

export interface CompTournament {
  type: TournamentType;
  scoring: ScoringMode;
  config: CompetitiveConfigJSON;
  entrants: Entrant[];
  groups: GroupJSON[];
  ties: TieJSON[];
}

/** What a format builder produces at creation time. */
export interface BuiltStructure {
  groups: GroupJSON[];
  ties: TieJSON[];
}
