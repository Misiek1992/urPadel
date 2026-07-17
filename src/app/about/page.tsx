import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { PadelMark } from "@/components/Logo";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "About us" };

const CONTACT_EMAIL = "m.ignaczak.92@gmail.com";

export default async function AboutPage() {
  const t = createT(await getLocale());

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("about.title")} />
      <div className="card card-pad flex flex-col items-center gap-6 text-center">
        <PadelMark size={48} />
        <p className="text-sm leading-relaxed text-slate-300">{t("about.intro")}</p>

        <div className="grid w-full gap-4 border-t border-white/10 pt-6 sm:grid-cols-2">
          <div>
            <p className="label">{t("about.authorHeading")}</p>
            <p className="text-base font-semibold text-white">{t("about.authorName")}</p>
          </div>
          <div>
            <p className="label">{t("about.contactHeading")}</p>
            <p className="text-sm text-slate-400">{t("about.contactText")}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-1 inline-block font-semibold text-volt-300 hover:text-volt-400"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
