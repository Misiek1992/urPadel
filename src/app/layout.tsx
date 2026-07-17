import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { plPL } from "@clerk/localizations";
import { SiteHeader } from "@/components/SiteHeader";
import { Logo } from "@/components/Logo";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { createT, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "urPadel — Americano & Mexicano padel tournaments",
    template: "%s · urPadel",
  },
  description:
    "Organize and track Americano and Mexicano padel tournaments: live courts, automatic pairings, club rankings and results — all in one place.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = createT(locale);

  return (
    <ClerkProvider
      localization={locale === "pl" ? plPL : undefined}
      appearance={{
        variables: {
          colorPrimary: "#d9f954",
          colorBackground: "#0d1a30",
          colorText: "#ffffff",
          colorInputBackground: "#0a1425",
          colorInputText: "#ffffff",
          colorTextSecondary: "#94a3b8",
        },
      }}
    >
      <LocaleProvider locale={locale} dict={dict}>
        <html lang={locale}>
          <body>
            <SiteHeader />
            <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
              {children}
            </main>
            <footer className="mt-16 border-t border-white/10">
              <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6">
                <Logo size={24} />
                <p>{t("footer.tagline")}</p>
              </div>
            </footer>
          </body>
        </html>
      </LocaleProvider>
    </ClerkProvider>
  );
}
