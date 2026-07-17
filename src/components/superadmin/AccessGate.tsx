// Polite access-denied states for the superadmin pages. Rendered by every
// /superadmin page when the viewer is not a super admin — never crash,
// never leak data. `t` is passed in so this also works from Server Components.

import Link from "next/link";
import { EmptyState } from "@/components/ui";
import type { Translator } from "@/lib/i18n";

export function SuperAdminDenied({
  email,
  t,
}: {
  email: string | null;
  t: Translator;
}) {
  if (!email) {
    return (
      <EmptyState
        title={t("superadminDenied.signInTitle")}
        hint={t("superadminDenied.signInHint")}
        action={
          <Link href="/sign-in" className="btn btn-primary">
            {t("superadminDenied.signIn")}
          </Link>
        }
      />
    );
  }
  return (
    <EmptyState
      title={t("superadminDenied.noAccessTitle")}
      hint={t("superadminDenied.noAccessHint", { email })}
      action={
        <Link href="/" className="btn btn-secondary">
          {t("superadminDenied.backHome")}
        </Link>
      }
    />
  );
}
