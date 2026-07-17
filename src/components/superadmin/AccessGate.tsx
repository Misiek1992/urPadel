// Polite access-denied states for the superadmin pages. Rendered by every
// /superadmin page when the viewer is not a super admin — never crash,
// never leak data.

import Link from "next/link";
import { EmptyState } from "@/components/ui";

export function SuperAdminDenied({ email }: { email: string | null }) {
  if (!email) {
    return (
      <EmptyState
        title="Sign in required"
        hint="The super admin panel is only available to signed-in super admin accounts."
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
      title="No access"
      hint={`You are signed in as ${email}, but this account does not have super admin access. Ask an existing super admin to add you.`}
      action={
        <Link href="/" className="btn btn-secondary">
          Back to home
        </Link>
      }
    />
  );
}
