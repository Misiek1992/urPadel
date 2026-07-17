// Shared (server- and client-safe) helper for rendering audit-log action
// slugs as consistently colored badges across the superadmin panel.

import { Badge } from "@/components/ui";

export type ActionTone = "volt" | "blue" | "red" | "slate";

/**
 * Color by action slug: destructive actions (ending in .delete / .remove)
 * are red, tournament.* volt, club.* blue, ranking.* (and everything else) slate.
 */
export function actionTone(action: string): ActionTone {
  if (action.endsWith(".delete") || action.endsWith(".remove")) return "red";
  if (action.startsWith("tournament.")) return "volt";
  if (action.startsWith("club.")) return "blue";
  if (action.startsWith("ranking.")) return "slate";
  return "slate";
}

export function ActionBadge({ action }: { action: string }) {
  return (
    <Badge tone={actionTone(action)} className="font-mono">
      {action}
    </Badge>
  );
}
