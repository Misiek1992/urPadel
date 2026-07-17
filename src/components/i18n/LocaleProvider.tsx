"use client";

// Client-side access to the dictionary the server picked for this request
// (via the locale cookie). The root layout is a Server Component that reads
// the cookie and passes the resolved locale/dict down as props here.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translate, type Dictionary, type Locale } from "@/lib/i18n";

type Vars = Record<string, string | number>;

interface LocaleContextValue {
  locale: Locale;
  dict: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT/useLocale must be used within LocaleProvider");
  return ctx;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

/** `t("section.key", {var: 1})` for client components. */
export function useT() {
  const { dict } = useLocaleContext();
  return (path: string, vars?: Vars) => translate(dict, path, vars);
}
