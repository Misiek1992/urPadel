// Access gating for /manager pages: polite empty states, never a crash.

import Link from "next/link";
import { EmptyState } from "@/components/ui";
import type { ViewerJSON } from "@/lib/types";

export function ManagerDenied({ viewer }: { viewer: ViewerJSON }) {
  if (!viewer.email) {
    return (
      <EmptyState
        title="Sign in required"
        hint="The club manager panel is available to signed-in club managers."
        action={
          <Link href="/sign-in" className="btn btn-primary">
            Sign in
          </Link>
        }
      />
    );
  }
  return (
    <EmptyState
      title="No club assigned to your account"
      hint={`You are signed in as ${viewer.email}, but this email is not a manager of any club yet. Ask a super admin to assign your email to your club.`}
      action={
        <Link href="/clubs" className="btn btn-secondary">
          Browse clubs
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
