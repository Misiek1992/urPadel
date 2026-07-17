// Access gating for /manager pages: polite empty states, never a crash.
// `t` is passed in (not read via a hook) so this works from Server Components.

import Link from "next/link";
import { EmptyState } from "@/components/ui";
import type { ViewerJSON } from "@/lib/types";
import type { Translator } from "@/lib/i18n";

export function ManagerDenied({
  viewer,
  t,
}: {
  viewer: ViewerJSON;
  t: Translator;
}) {
  if (!viewer.email) {
    return (
      <EmptyState
        title={t("managerDashboard.deniedSignInTitle")}
        hint={t("managerDashboard.deniedSignInHint")}
        action={
          <Link href="/sign-in" className="btn btn-primary">
            {t("nav.signIn")}
          </Link>
        }
      />
    );
  }
  return (
    <EmptyState
      title={t("managerDashboard.deniedNoClubTitle")}
      hint={t("managerDashboard.deniedNoClubHint", { email: viewer.email })}
      action={
        <Link href="/clubs" className="btn btn-secondary">
          {t("managerDashboard.browseClubs")}
        </Link>
      }
    />
  );
}

/** Picks the active club from ?club= (must be managed), else the first one. */
export function resolveActiveClub(
  viewer: ViewerJSON,
  clubParam: string | undefined
): { _id: string; name: string; slug: string } | null {
  if (viewer.managedClubs.length === 0) return null;
  return (
    viewer.managedClubs.find((c) => c._id === clubParam) ??
    viewer.managedClubs[0]
  );
}
