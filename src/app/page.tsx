import Link from "next/link";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer, Tournament } from "@/lib/models";
import { serialize, type ClubJSON } from "@/lib/types";
import { pointsForPosition, RANKING_WINDOW_DAYS } from "@/lib/ranking";
import { formatOptions } from "@/lib/i18n/formats";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { PadelMark } from "@/components/Logo";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function CourtIllustration() {
  return (
    <svg
      viewBox="0 0 360 220"
      className="h-auto w-full max-w-md drop-shadow-[0_0_35px_rgba(217,249,84,0.15)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="court-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12213d" />
          <stop offset="1" stopColor="#0a1425" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="340" height="200" rx="16" fill="url(#court-bg)" stroke="#d9f954" strokeWidth="2.5" />
      <line x1="180" y1="10" x2="180" y2="210" stroke="#d9f954" strokeWidth="2" strokeDasharray="7 6" opacity="0.9" />
      <line x1="95" y1="42" x2="95" y2="178" stroke="#4aa8ff" strokeWidth="1.5" opacity="0.6" />
      <line x1="265" y1="42" x2="265" y2="178" stroke="#4aa8ff" strokeWidth="1.5" opacity="0.6" />
      <line x1="95" y1="110" x2="265" y2="110" stroke="#4aa8ff" strokeWidth="1.5" opacity="0.6" />
      <circle cx="140" cy="75" r="9" fill="#d9f954" />
      <path d="M133.5 71.5a9 9 0 0 1 13 0" stroke="#0a1425" strokeWidth="1.4" fill="none" />
      <path d="M133.5 78.5a9 9 0 0 0 13 0" stroke="#0a1425" strokeWidth="1.4" fill="none" />
      <circle cx="228" cy="150" r="6" fill="#4aa8ff" opacity="0.9" />
    </svg>
  );
}

export default async function LandingPage() {
  const t = createT(await getLocale());

  await dbConnect();
  const clubsRaw = await Club.find({}).sort({ name: 1 }).limit(6).lean();
  const clubs = serialize<ClubJSON[]>(clubsRaw);
  const clubStats = await Promise.all(
    clubs.map(async (club) => {
      const [players, tournaments] = await Promise.all([
        ClubPlayer.countDocuments({ clubId: club._id }),
        Tournament.countDocuments({ clubId: club._id }),
      ]);
      return { club, players, tournaments };
    })
  );

  const howItWorks = [
    { step: "1", title: t("home.how1Title"), text: t("home.how1Text") },
    { step: "2", title: t("home.how2Title"), text: t("home.how2Text") },
    { step: "3", title: t("home.how3Title"), text: t("home.how3Text") },
    { step: "4", title: t("home.how4Title"), text: t("home.how4Text") },
  ];

  return (
    <div className="space-y-20 pb-8">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-2">
        <div>
          <span className="badge badge-volt mb-5">{t("home.badge")}</span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            {t("home.titleLine1")}{" "}
            <span className="text-volt-400">{t("home.titleAmericano")}</span>{" "}
            {t("home.titleAnd")}{" "}
            <span className="text-volt-400">{t("home.titleMexicano")}</span>{" "}
            {t("home.titleLine2")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-400">{t("home.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/clubs" className="btn btn-primary btn-lg">
              {t("home.exploreClubs")}
            </Link>
            <Link href="/manager" className="btn btn-secondary btn-lg">
              {t("home.organizeTournament")}
            </Link>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <CourtIllustration />
        </div>
      </section>

      {/* Formats */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <PadelMark size={26} />
          <h2 className="text-2xl font-extrabold text-white">
            {t("home.formatsHeading")}
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {formatOptions(t).map((f) => (
            <div key={f.value} className="card card-pad">
              <h3 className="text-lg font-bold text-volt-300">{f.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {f.description}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">{t("home.formatsFooter")}</p>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-6 text-2xl font-extrabold text-white">
          {t("home.howItWorksHeading")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((item) => (
            <div key={item.step} className="card card-pad">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-volt-400 text-base font-extrabold text-navy-950">
                {item.step}
              </span>
              <h3 className="mt-4 text-base font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Ranking teaser */}
      <section className="card card-pad overflow-hidden">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold text-white">
              {t("home.rankingHeading")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              {t("home.rankingText", { days: RANKING_WINDOW_DAYS })}
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-center gap-2">
            {[2, 1, 3].map((pos) => (
              <div
                key={pos}
                className={`flex w-24 flex-col items-center justify-end rounded-t-2xl border border-white/10 bg-white/[0.05] ${
                  pos === 1 ? "h-36" : pos === 2 ? "h-28" : "h-24"
                }`}
              >
                <span className="text-2xl">{["🥇", "🥈", "🥉"][pos - 1]}</span>
                <span className="text-xl font-extrabold text-volt-300">
                  {pointsForPosition(pos)}
                </span>
                <span className="mb-3 text-[11px] uppercase tracking-wider text-slate-500">
                  {t("home.pointsLabel")}
                </span>
              </div>
            ))}
            <div className="flex h-16 w-24 flex-col items-center justify-end rounded-t-2xl border border-white/10 bg-white/[0.03]">
              <span className="text-xl font-extrabold text-slate-400">1</span>
              <span className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                {t("home.participationLabel")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Clubs */}
      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold text-white">{t("home.clubsHeading")}</h2>
          <Link href="/clubs" className="text-sm font-semibold text-volt-300 hover:text-volt-400">
            {t("home.allClubs")}
          </Link>
        </div>
        {clubStats.length === 0 ? (
          <EmptyState title={t("home.noClubsTitle")} hint={t("home.noClubsHint")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubStats.map(({ club, players, tournaments }) => (
              <Link
                key={club._id}
                href={`/club/${club.slug}`}
                className="card card-pad transition-colors hover:border-volt-400/40"
              >
                <h3 className="text-lg font-bold text-white">{club.name}</h3>
                {club.city && (
                  <p className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">
                    {club.city}
                  </p>
                )}
                {club.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-slate-400">
                    {club.description}
                  </p>
                )}
                <p className="mt-4 text-xs text-slate-500">
                  <span className="font-semibold text-volt-300">{players}</span>{" "}
                  {t("home.playersCount")} ·{" "}
                  <span className="font-semibold text-volt-300">{tournaments}</span>{" "}
                  {t("home.tournamentsCount")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
