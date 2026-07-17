"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
} from "@/components/ui";
import type { ClubJSON } from "@/lib/types";
import { isValidEmail, NETWORK_ERROR, readApiError } from "./api";

export function ClubsManager({
  clubs,
  playersByClub,
  tournamentsByClub,
}: {
  clubs: ClubJSON[];
  playersByClub: Record<string, number>;
  tournamentsByClub: Record<string, number>;
}) {
  return (
    <div className="space-y-6">
      <CreateClubForm />
      {clubs.length === 0 ? (
        <EmptyState
          title="No clubs yet"
          hint="Create the first club with the form above — you can assign manager emails right after."
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
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Club name is required.");
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
      <h3 className="section-title">Create a club</h3>
      <p className="mt-1 text-sm text-slate-400">
        The public URL slug is generated automatically from the name.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="club-name">
              Name
            </label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Padel Arena Warszawa"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="club-city">
              City
            </label>
            <Input
              id="club-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Warszawa"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="club-description">
            Description
          </label>
          <Textarea
            id="club-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description shown on the club's public page…"
            rows={3}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Spinner className="h-3.5 w-3.5" />}
            Create club
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
  const [managerEmail, setManagerEmail] = useState("");
  const [addingManager, setAddingManager] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [managerError, setManagerError] = useState<string | null>(null);
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

  async function addManager(e: FormEvent) {
    e.preventDefault();
    const email = managerEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setManagerError("Enter a valid email address.");
      return;
    }
    setAddingManager(true);
    setManagerError(null);
    try {
      const res = await fetch(`/api/clubs/${club._id}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setManagerError(await readApiError(res));
        return;
      }
      setManagerEmail("");
      router.refresh();
    } catch {
      setManagerError(NETWORK_ERROR);
    } finally {
      setAddingManager(false);
    }
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
          <span className="font-semibold text-white">{playerCount}</span> players ·{" "}
          <span className="font-semibold text-white">{tournamentCount}</span> tournaments
        </p>
      </div>

      {club.description && (
        <p className="text-sm text-slate-400">{club.description}</p>
      )}

      <div>
        <p className="label">Managers</p>
        {club.managerEmails.length === 0 ? (
          <p className="text-xs text-slate-500">
            No managers yet — add an email below to give someone access to the
            manager panel for this club.
          </p>
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
                  aria-label={`Remove manager ${email}`}
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
        <form onSubmit={addManager} className="mt-3 flex gap-2">
          <Input
            type="email"
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
            placeholder="manager@example.com"
            aria-label={`Add manager email for ${club.name}`}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={addingManager}>
            {addingManager && <Spinner className="h-3 w-3" />}
            Add
          </Button>
        </form>
        <ErrorText>{managerError}</ErrorText>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
        <Link href={`/club/${club.slug}`} className="btn btn-ghost btn-sm">
          Public page
        </Link>
        <Link href={`/manager?club=${club._id}`} className="btn btn-ghost btn-sm">
          Manager panel
        </Link>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => setDeleteOpen(true)}
        >
          Delete club
        </Button>
      </div>

      <Modal
        open={deleteOpen}
        onClose={closeDeleteModal}
        title={`Delete ${club.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deleteClub}
              disabled={deleting || !confirmMatches}
            >
              {deleting && <Spinner className="h-3.5 w-3.5" />}
              Delete club permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          This permanently deletes{" "}
          <span className="font-semibold text-white">{club.name}</span> and
          everything that belongs to it:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-400">
          <li>
            <span className="font-semibold text-white">{playerCount}</span> roster
            players
          </li>
          <li>
            <span className="font-semibold text-white">{tournamentCount}</span>{" "}
            tournaments with all their rounds and results
          </li>
          <li>the entire club ranking history</li>
        </ul>
        <p className="mt-3 text-sm font-semibold text-red-300">
          This cannot be undone.
        </p>
        <label className="label mt-4" htmlFor={`confirm-delete-${club._id}`}>
          Type the club name to confirm
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
