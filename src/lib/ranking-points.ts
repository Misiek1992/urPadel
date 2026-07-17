// Pure constants/functions with zero server dependencies (no mongoose, no
// dbConnect) so they're safe to import from client components without
// bundling the database driver into the browser. Server code should keep
// importing these from "./ranking", which re-exports them.

export const RANKING_WINDOW_DAYS = 365;

export function pointsForPosition(position: number): number {
  if (position >= 1 && position <= 10) return 110 - position * 10;
  return 1;
}
