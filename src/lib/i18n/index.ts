// Client-safe i18n exports — no next/headers here, so this file can be
// imported from "use client" components. Server-only cookie reading lives in
// ./server.ts.
import en from "./en";
import pl from "./pl";

export type Locale = "en" | "pl";
export const LOCALES: Locale[] = ["en", "pl"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "urpadel_locale";

export type Dictionary = {
  [Section in keyof typeof en]: {
    [Key in keyof (typeof en)[Section]]: string;
  };
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, pl };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "pl";
}

type Section = keyof Dictionary;
type Key<S extends Section> = keyof Dictionary[S];
type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

/** `t("section.key", {var: 1})` — pure function, usable anywhere with a dictionary. */
export function translate(dict: Dictionary, path: string, vars?: Vars): string {
  const [section, key] = path.split(".") as [Section, string];
  const template = dict[section]?.[key as Key<typeof section>];
  if (typeof template !== "string") return path;
  return interpolate(template, vars);
}

export type Translator = (path: string, vars?: Vars) => string;

/** For async Server Components: `const t = createT(await getLocale());` */
export function createT(locale: Locale): Translator {
  const dict = getDictionary(locale);
  return (path, vars) => translate(dict, path, vars);
}
