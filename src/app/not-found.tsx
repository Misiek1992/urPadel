import Link from "next/link";
import { PadelMark } from "@/components/Logo";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

// A custom not-found page forces Next.js to render this route dynamically
// (per-request) instead of trying to prerender the built-in /_not-found
// route at build time — which would run outside any request context and
// crash if ClerkProvider (in the root layout) can't find its publishable
// key at that exact moment.
export const dynamic = "force-dynamic";

export default async function NotFound() {
  const t = createT(await getLocale());
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <PadelMark size={56} />
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-volt-300">
          {t("notFound.eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
          {t("notFound.title")}
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-400">
          {t("notFound.subtitle")}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          {t("notFound.backHome")}
        </Link>
        <Link href="/clubs" className="btn btn-secondary">
          {t("notFound.browseClubs")}
        </Link>
      </div>
    </div>
  );
}
