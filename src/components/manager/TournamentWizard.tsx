"use client";

// Five-step tournament creation wizard:
// format → basics → players (roster / quick add / Playtomic-CSV import,
// team building for team formats) → courts (numbered or custom names) →
// review & start.

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Spinner,
  Textarea,
  cn,
} from "@/components/ui";
import type { ClubPlayerJSON, TournamentJSON } from "@/lib/types";
import {
  MATCH_POINTS_OPTIONS,
  isTeamType,
  validateTournamentSetup,
  type TournamentType,
} from "@/lib/engine";
import { formatLabel, formatOptions } from "@/lib/i18n/formats";
import { parsePlayersText } from "@/lib/players-import";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import type { Translator } from "@/lib/i18n";

function defaultName(t: Translator, type: TournamentType): string {
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatLabel(t, type)} — ${date}`;
}

/** Simplified two-way plural: exact singular vs. a shared "other" form. */
function pluralSuffix(count: number, locale: "en" | "pl", en: string, pl: string): string {
  if (count === 1) return "";
  return locale === "pl" ? pl : en;
}

export function TournamentWizard({
  clubId,
  roster,
}: {
  clubId: string;
  roster: ClubPlayerJSON[];
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [step, setStep] = useState(0);

  const STEPS = [
    t("wizard.stepFormat"),
    t("wizard.stepBasics"),
    t("wizard.stepPlayers"),
    t("wizard.stepCourts"),
    t("wizard.stepStart"),
  ];

  const [type, setType] = useState<TournamentType>("americano");
  const [name, setName] = useState(() => defaultName(t, "americano"));
  const [nameTouched, setNameTouched] = useState(false);
  const [matchPoints, setMatchPoints] = useState<number>(24);
  const [customPoints, setCustomPoints] = useState("");

  const [players, setPlayers] = useState<string[]>([]);
  const [quickAdd, setQuickAdd] = useState("");
  const [importText, setImportText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [courtMode, setCourtMode] = useState<"numbered" | "custom">("numbered");
  const [courtCount, setCourtCount] = useState(2);
  const [customCourts, setCustomCourts] = useState("");
  const [courtsTouched, setCourtsTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const team = isTeamType(type);
  const playersLower = useMemo(
    () => new Set(players.map((p) => p.toLowerCase())),
    [players]
  );

  const teams = useMemo(() => {
    if (!team) return [];
    const result: [string, string][] = [];
    for (let i = 0; i + 1 < players.length; i += 2) {
      result.push([players[i], players[i + 1]]);
    }
    return result;
  }, [team, players]);

  const entrantCount = team ? teams.length : players.length;
  const suggestedCourts = Math.max(
    1,
    Math.min(team ? Math.floor(entrantCount / 2) : Math.floor(players.length / 4), 8)
  );
  const effectiveCourtCount = courtsTouched ? courtCount : suggestedCourts;

  const courts = useMemo(() => {
    if (courtMode === "numbered") {
      return Array.from({ length: effectiveCourtCount }, (_, i) => `Court ${i + 1}`);
    }
    const seen = new Set<string>();
    return customCourts
      .split(/\r?\n|,/)
      .map((c) => c.trim())
      .filter((c) => {
        if (!c || seen.has(c.toLowerCase())) return false;
        seen.add(c.toLowerCase());
        return true;
      });
  }, [courtMode, effectiveCourtCount, customCourts]);

  const parsedImport = useMemo(() => parsePlayersText(importText), [importText]);
  const importNew = parsedImport.filter((n) => !playersLower.has(n.toLowerCase()));

  const setupError = validateTournamentSetup(type, entrantCount, courts.length);
  const oddPlayerForTeams = team && players.length % 2 !== 0;
  const byeWarning = !team && players.length >= 4 && players.length % 4 !== 0;
  const teamByeWarning = team && teams.length >= 2 && teams.length % 2 !== 0;

  function addPlayers(names: string[]) {
    const additions = names
      .map((n) => n.trim())
      .filter((n) => n && !playersLower.has(n.toLowerCase()));
    if (additions.length === 0) return;
    setPlayers((prev) => [...prev, ...additions]);
  }

  function removePlayer(name: string) {
    setPlayers((prev) => prev.filter((p) => p !== name));
  }

  function movePlayer(index: number, delta: number) {
    setPlayers((prev) => {
      const next = [...prev];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function shufflePlayers() {
    setPlayers((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImportText(await file.text());
  }

  async function start() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const entrants = team
        ? teams.map(([a, b]) => ({ name: `${a} / ${b}`, players: [a, b] }))
        : players.map((p) => ({ name: p }));
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          matchPoints,
          courts,
          entrants,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { tournament?: TournamentJSON; error?: string }
        | null;
      if (!res.ok || !data?.tournament) {
        setSubmitError(data?.error ?? t("common.requestFailed", { status: res.status }));
        return;
      }
      router.push(`/manager/tournaments/${data.tournament._id}?club=${clubId}`);
    } catch {
      setSubmitError(t("common.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  const canNext =
    step === 0
      ? true
      : step === 1
        ? name.trim().length > 0 && matchPoints >= 4
        : step === 2
          ? !setupError || courts.length === 0
          : step === 3
            ? courts.length > 0
            : false;

  const kindLabel = team
    ? t("wizard.selectedPlayersKindTeams")
    : t("wizard.selectedPlayersKindPlayers");

  return (
    <div className="mx-auto max-w-3xl">
      {/* Step indicator */}
      <ol className="mb-8 flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                i === step
                  ? "bg-volt-400 text-navy-950"
                  : i < step
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "bg-white/[0.03] text-slate-500"
              )}
            >
              <span>{i + 1}</span>
              {label}
            </button>
            {i < STEPS.length - 1 && (
              <span className="h-px w-4 bg-white/10" aria-hidden />
            )}
          </li>
        ))}
      </ol>

      {/* Step 1: format */}
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {formatOptions(t).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setType(f.value);
                if (!nameTouched) setName(defaultName(t, f.value));
              }}
              className={cn(
                "card card-pad text-left transition-colors",
                type === f.value
                  ? "border-volt-400/70 bg-volt-400/[0.06]"
                  : "hover:border-white/25"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{f.label}</h3>
                {type === f.value && <Badge tone="volt">{t("wizard.selected")}</Badge>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {f.description}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: basics */}
      {step === 1 && (
        <Card>
          <div className="space-y-5">
            <div>
              <label className="label">{t("wizard.basicsNameLabel")}</label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
              />
            </div>
            <div>
              <label className="label">{t("wizard.basicsPointsLabel")}</label>
              <div className="flex flex-wrap items-center gap-2">
                {MATCH_POINTS_OPTIONS.map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => {
                      setMatchPoints(pts);
                      setCustomPoints("");
                    }}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-bold transition-colors",
                      matchPoints === pts && customPoints === ""
                        ? "bg-volt-400 text-navy-950"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    )}
                  >
                    {pts}
                  </button>
                ))}
                <Input
                  type="number"
                  min={4}
                  max={128}
                  value={customPoints}
                  onChange={(e) => {
                    setCustomPoints(e.target.value);
                    const v = Number(e.target.value);
                    if (Number.isInteger(v) && v >= 4 && v <= 128) setMatchPoints(v);
                  }}
                  placeholder={t("wizard.customPointsPlaceholder")}
                  className="w-24"
                  aria-label={t("wizard.customPointsPlaceholder")}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {t("wizard.matchEndsHint", {
                  points: matchPoints,
                  a: Math.ceil(matchPoints * 0.66),
                  b: matchPoints - Math.ceil(matchPoints * 0.66),
                })}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: players */}
      {step === 2 && (
        <div className="space-y-5">
          <Card>
            <h3 className="section-title">
              {t("wizard.selectedPlayers", { kind: kindLabel, count: players.length })}
            </h3>
            {players.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">{t("wizard.pickHint")}</p>
            ) : team ? (
              <div className="mt-3 space-y-2">
                {teams.map(([a, b], ti) => (
                  <div
                    key={`${a}-${b}`}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <Badge tone="volt">{t("wizard.teamLabel", { n: ti + 1 })}</Badge>
                    <span className="text-sm font-semibold text-white">
                      {a} / {b}
                    </span>
                  </div>
                ))}
                {oddPlayerForTeams && (
                  <p className="text-xs font-medium text-amber-400">
                    {t("wizard.oddPlayerWarning", { name: players[players.length - 1] })}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {players.map((p, i) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-1 text-xs font-medium text-slate-200"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() => movePlayer(i, -1)}
                        className="rounded p-0.5 text-slate-400 hover:text-white"
                        aria-label={`Move ${p} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => movePlayer(i, 1)}
                        className="rounded p-0.5 text-slate-400 hover:text-white"
                        aria-label={`Move ${p} down`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removePlayer(p)}
                        className="rounded p-0.5 text-slate-400 hover:text-red-300"
                        aria-label={`Remove ${p}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <Button variant="secondary" size="sm" onClick={shufflePlayers}>
                  {t("wizard.shufflePairs")}
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {players.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-1 text-xs font-medium text-slate-200"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => removePlayer(p)}
                      className="rounded p-0.5 text-slate-400 hover:text-red-300"
                      aria-label={`Remove ${p}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            {byeWarning && (
              <p className="mt-3 text-xs font-medium text-amber-400">
                {t("wizard.byeWarningIndividual", {
                  count: players.length,
                  rest: players.length % 4,
                  plural: pluralSuffix(players.length % 4, locale, "s", "e"),
                })}
              </p>
            )}
            {teamByeWarning && (
              <p className="mt-3 text-xs font-medium text-amber-400">
                {t("wizard.teamByeWarning", { count: teams.length })}
              </p>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h4 className="text-sm font-bold text-white">{t("wizard.fromRoster")}</h4>
              {roster.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">{t("wizard.emptyRoster")}</p>
              ) : (
                <div className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
                  {roster.map((p) => {
                    const checked = playersLower.has(p.name.toLowerCase());
                    return (
                      <label
                        key={p._id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            checked ? removePlayer(p.name) : addPlayers([p.name])
                          }
                          className="h-4 w-4 accent-[#d9f954]"
                        />
                        <span
                          className={checked ? "font-semibold text-white" : "text-slate-300"}
                        >
                          {p.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
                <Input
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPlayers([quickAdd]);
                      setQuickAdd("");
                    }
                  }}
                  placeholder={t("wizard.quickAddPlaceholder")}
                  aria-label={t("wizard.quickAddPlaceholder")}
                  className="min-w-0 flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    addPlayers([quickAdd]);
                    setQuickAdd("");
                  }}
                >
                  {t("wizard.quickAdd")}
                </Button>
              </div>
            </Card>

            <Card>
              <h4 className="text-sm font-bold text-white">{t("wizard.importTitle")}</h4>
              <div className="mt-3 space-y-3">
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={4}
                  placeholder={t("wizard.importPlaceholder")}
                  aria-label={t("wizard.importTitle")}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
                  aria-label={t("wizard.importTitle")}
                />
                {parsedImport.length > 0 && (
                  <p className="text-xs text-slate-400">
                    {t("wizard.foundNamesNew", {
                      count: parsedImport.length,
                      new: importNew.length,
                    })}
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={importNew.length === 0}
                  onClick={() => {
                    addPlayers(importNew);
                    setImportText("");
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  {t("wizard.addToList", {
                    count: importNew.length,
                    plural: pluralSuffix(importNew.length, locale, "s", "y"),
                  })}
                </Button>
              </div>
            </Card>
          </div>
          {setupError && players.length > 0 && (
            <p className="text-sm font-medium text-amber-400">{setupError}</p>
          )}
        </div>
      )}

      {/* Step 4: courts */}
      {step === 3 && (
        <Card>
          <div className="flex gap-2">
            {(
              [
                ["numbered", t("wizard.numberedCourts")],
                ["custom", t("wizard.customCourts")],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCourtMode(mode)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-bold transition-colors",
                  courtMode === mode
                    ? "bg-volt-400 text-navy-950"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {courtMode === "numbered" ? (
            <div className="mt-5">
              <label className="label">{t("wizard.numberOfCourts")}</label>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCourtsTouched(true);
                    setCourtCount(Math.max(1, effectiveCourtCount - 1));
                  }}
                >
                  −
                </Button>
                <span className="w-10 text-center text-2xl font-extrabold text-white">
                  {effectiveCourtCount}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCourtsTouched(true);
                    setCourtCount(Math.min(16, effectiveCourtCount + 1));
                  }}
                >
                  +
                </Button>
                <span className="text-xs text-slate-500">
                  {t("wizard.suggestedFor", {
                    count: entrantCount,
                    kind: kindLabel,
                    suggested: suggestedCourts,
                  })}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <label className="label">{t("wizard.courtNamesLabel")}</label>
              <Textarea
                value={customCourts}
                onChange={(e) => setCustomCourts(e.target.value)}
                rows={4}
                placeholder={t("wizard.courtNamesPlaceholder")}
              />
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-1.5">
            {courts.map((c) => (
              <Badge key={c} tone="blue">
                {c}
              </Badge>
            ))}
            {courts.length === 0 && (
              <p className="text-xs text-amber-400">{t("wizard.addAtLeastOneCourt")}</p>
            )}
          </div>
        </Card>
      )}

      {/* Step 5: review */}
      {step === 4 && (
        <Card>
          <h3 className="section-title">{t("wizard.readyTitle")}</h3>
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="label">{t("wizard.reviewTournament")}</dt>
              <dd className="font-semibold text-white">{name}</dd>
            </div>
            <div>
              <dt className="label">{t("wizard.reviewFormat")}</dt>
              <dd>
                <Badge tone="blue">{formatLabel(t, type)}</Badge>
              </dd>
            </div>
            <div>
              <dt className="label">{team ? t("wizard.reviewTeams") : t("wizard.reviewPlayers")}</dt>
              <dd className="font-semibold text-white">
                {team
                  ? t("wizard.reviewTeamsValue", { count: entrantCount, players: players.length })
                  : t("wizard.reviewPlayersValue", { count: entrantCount })}
              </dd>
            </div>
            <div>
              <dt className="label">{t("wizard.reviewPoints")}</dt>
              <dd className="font-semibold text-white">{matchPoints}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="label">{t("wizard.reviewCourts")}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {courts.map((c) => (
                  <Badge key={c} tone="blue">
                    {c}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
          {setupError ? (
            <p className="mt-4 text-sm font-medium text-red-400">{setupError}</p>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              {t("wizard.seedingNotePrefix")}{" "}
              {type.startsWith("mexicano")
                ? t("wizard.seedingNoteMexicano")
                : t("wizard.seedingNoteOther")}
            </p>
          )}
          <ErrorText>{submitError}</ErrorText>
        </Card>
      )}

      {/* Nav buttons */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          {t("wizard.back")}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            {t("wizard.continue")}
          </Button>
        ) : (
          <Button onClick={start} disabled={submitting || Boolean(setupError)} size="lg">
            {submitting && <Spinner className="h-4 w-4" />}
            {t("wizard.start")}
          </Button>
        )}
      </div>
    </div>
  );
}
