"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Input,
  Modal,
  Spinner,
  Textarea,
  cn,
} from "@/components/ui";
import type { ClubJSON } from "@/lib/types";
import { isValidEmail, NETWORK_ERROR, readApiError } from "./api";
import type { ClerkUserSummary } from "@/app/api/superadmin/users/route";
import { useT } from "@/components/i18n/LocaleProvider";

export function ClubsManager({
  clubs,
  playersByClub,
  tournamentsByClub,
}: {
  clubs: ClubJSON[];
  playersByClub: Record<string, number>;
  tournamentsByClub: Record<string, number>;
}) {
  const t = useT();
  return (
    <div className="space-y-6">
      <CreateClubForm />
      {clubs.length === 0 ? (
        <EmptyState
          title={t("superadminClubs.noClubsTitle")}
          hint={t("superadminClubs.noClubsHint")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clubs.map((club) => (
            <ClubCard
              key={club._id}
              club={club}
              playerCount={playersByClub[club._id] ?? 0}
              tournamentCount={tournamentsByClub[club._id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateClubForm() {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("superadminClubs.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          city: city.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      setName("");
      setCity("");
      setDescription("");
      router.refresh();
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h3 className="section-title">{t("superadminClubs.createTitle")}</h3>
      <p className="mt-1 text-sm text-slate-400">{t("superadminClubs.createHint")}</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="club-name">
              {t("superadminClubs.nameLabel")}
            </label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("superadminClubs.namePlaceholder")}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="club-city">
              {t("superadminClubs.cityLabel")}
            </label>
            <Input
              id="club-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("superadminClubs.cityPlaceholder")}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="club-description">
            {t("superadminClubs.descriptionLabel")}
          </label>
          <Textarea
            id="club-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("superadminClubs.descriptionPlaceholder")}
            rows={3}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {t("superadminClubs.createBtn")}
          </Button>
        </div>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}

function ClubCard({
  club,
  playerCount,
  tournamentCount,
}: {
  club: ClubJSON;
  playerCount: number;
  tournamentCount: number;
}) {
  const router = useRouter();
  const t = useT();
  const [managerEmail, setManagerEmail] = useState("");
  const [addingManager, setAddingManager] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ClerkUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmMatches =
    confirmName.trim().toLowerCase() === club.name.trim().toLowerCase();

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteOpen(false);
    setConfirmName("");
    setDeleteError(null);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = managerEmail.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/superadmin/users?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { users: ClerkUserSummary[] };
          setSuggestions(
            data.users.filter(
              (u) => !club.managerEmails.includes(u.email)
            )
          );
        }
      } catch {
        // Search is a convenience — silently ignore network hiccups.
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerEmail]);

  async function addManagerEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setManagerError(t("superadminClubs.invalidEmail"));
      return;
    }
    setAddingManager(true);
    setManagerError(null);
    try {
      const res = await fetch(`/api/clubs/${club._id}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      if (!res.ok) {
        setManagerError(await readApiError(res));
        return;
      }
      setManagerEmail("");
      setSuggestions([]);
      setShowSuggestions(false);
      router.refresh();
    } catch {
      setManagerError(NETWORK_ERROR);
    } finally {
      setAddingManager(false);
    }
  }

  async function addManager(e: FormEvent) {
    e.preventDefault();
    await addManagerEmail(managerEmail);
  }

  async function removeManager(email: string) {
    setRemovingEmail(email);
    setManagerError(null);
    try {
      const res = await fetch(
        `/api/clubs/${club._id}/managers?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setManagerError(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      setManagerError(NETWORK_ERROR);
    } finally {
      setRemovingEmail(null);
    }
  }

  async function deleteClub() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/clubs/${club._id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleteError(await readApiError(res));
        return;
      }
      setDeleteOpen(false);
      router.refresh();
    } catch {
      setDeleteError(NETWORK_ERROR);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-white">{club.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="slate" className="font-mono">
              /{club.slug}
            </Badge>
            {club.city && <span className="text-xs text-slate-400">{club.city}</span>}
          </div>
        </div>
        <p className="shrink-0 text-xs text-slate-400">
          <span className="font-semibold text-white">{playerCount}</span>{" "}
          {t("superadminClubs.playersLabel")} ·{" "}
          <span className="font-semibold text-white">{tournamentCount}</span>{" "}
          {t("superadminClubs.tournamentsLabel")}
        </p>
      </div>

      {club.description && (
        <p className="text-sm text-slate-400">{club.description}</p>
      )}

      <div>
        <p className="label">{t("superadminClubs.managersLabel")}</p>
        {club.managerEmails.length === 0 ? (
          <p className="text-xs text-slate-500">{t("superadminClubs.noManagersHint")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {club.managerEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-1.5 text-xs font-medium text-slate-200"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeManager(email)}
                  disabled={removingEmail !== null}
                  aria-label={t("superadminClubs.removeManagerAria", { email })}
                  className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removingEmail === email ? (
                    <Spinner className="h-3 w-3" />
                  ) : (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={addManager} className="relative mt-3 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              type="text"
              value={managerEmail}
              onChange={(e) => {
                setManagerEmail(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={t("superadminClubs.searchPlaceholder")}
              aria-label={t("superadminClubs.addManagerAria", { name: club.name })}
              className="w-full"
            />
            {showSuggestions && managerEmail.trim().length >= 2 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-navy-850 shadow-xl">
                {searching ? (
                  <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400">
                    <Spinner className="h-3 w-3" /> {t("superadminClubs.searching")}
                  </p>
                ) : suggestions.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-slate-500">
                    {t("superadminClubs.noUsersFound")}
                  </p>
                ) : (
                  suggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addManagerEmail(u.email);
                      }}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-white/5"
                      )}
                    >
                      {u.name && (
                        <span className="font-semibold text-white">{u.name}</span>
                      )}
                      <span className="text-xs text-slate-400">{u.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Button type="submit" variant="secondary" size="sm" disabled={addingManager}>
            {addingManager && <Spinner className="h-3 w-3" />}
            {t("superadminClubs.add")}
          </Button>
        </form>
        <ErrorText>{managerError}</ErrorText>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
        <Link href={`/club/${club.slug}`} className="btn btn-ghost btn-sm">
          {t("superadminClubs.publicPage")}
        </Link>
        <Link href={`/manager?club=${club._id}`} className="btn btn-ghost btn-sm">
          {t("superadminClubs.managerPanel")}
        </Link>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => setDeleteOpen(true)}
        >
          {t("superadminClubs.deleteClub")}
        </Button>
      </div>

      <Modal
        open={deleteOpen}
        onClose={closeDeleteModal}
        title={t("superadminClubs.deleteModalTitle", { name: club.name })}
        footer={
          <>
            <Button variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
              {t("superadminClubs.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={deleteClub}
              disabled={deleting || !confirmMatches}
            >
              {deleting && <Spinner className="h-3.5 w-3.5" />}
              {t("superadminClubs.deletePermanently")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {t("superadminClubs.deleteIntro", { name: club.name })}
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-400">
          <li>{t("superadminClubs.deletePlayersItem", { count: playerCount })}</li>
          <li>{t("superadminClubs.deleteTournamentsItem", { count: tournamentCount })}</li>
          <li>{t("superadminClubs.deleteRankingItem")}</li>
        </ul>
        <p className="mt-3 text-sm font-semibold text-red-300">
          {t("superadminClubs.deleteWarning")}
        </p>
        <label className="label mt-4" htmlFor={`confirm-delete-${club._id}`}>
          {t("superadminClubs.confirmNamePrompt")}
        </label>
        <Input
          id={`confirm-delete-${club._id}`}
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={club.name}
          autoComplete="off"
        />
        <ErrorText>{deleteError}</ErrorText>
      </Modal>
    </Card>
  );
}
