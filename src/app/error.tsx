"use client";

// Route-segment error boundary. Renders inside the root layout (so the
// header/footer and LocaleProvider context are still intact) whenever a
// page below it throws — e.g. a database hiccup on a force-dynamic page.

import { useEffect } from "react";
import Link from "next/link";
import { PadelMark } from "@/components/Logo";
import { useT } from "@/components/i18n/LocaleProvider";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <PadelMark size={56} />
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-volt-300">
          {t("error.eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
          {t("error.title")}
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-400">{t("error.subtitle")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={() => reset()} className="btn btn-primary">
          {t("error.retry")}
        </button>
        <Link href="/" className="btn btn-secondary">
          {t("error.backHome")}
        </Link>
      </div>
    </div>
  );
}
