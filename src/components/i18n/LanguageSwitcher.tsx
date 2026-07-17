"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n";
import { useLocale, useT } from "./LocaleProvider";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLocale(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          disabled={pending}
          aria-current={locale === l}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-bold uppercase transition-colors disabled:opacity-60",
            locale === l
              ? "bg-volt-400 text-navy-950"
              : "text-slate-400 hover:text-white"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
