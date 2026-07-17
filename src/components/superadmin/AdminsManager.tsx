"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Modal,
  Spinner,
} from "@/components/ui";
import { isValidEmail, NETWORK_ERROR, readApiError } from "./api";

export function AdminsManager({
  emails,
  defaultEmail,
  viewerEmail,
}: {
  emails: string[];
  defaultEmail: string;
  viewerEmail: string | null;
}) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  function closeRemoveModal() {
    if (removing) return;
    setPendingRemoval(null);
    setRemoveError(null);
  }

  async function addAdmin(e: FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setAddError("Enter a valid email address.");
      return;
    }
    if (emails.includes(email)) {
      setAddError("This email is already a super admin.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/superadmins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setAddError(await readApiError(res));
        return;
      }
      setNewEmail("");
      router.refresh();
    } catch {
      setAddError(NETWORK_ERROR);
    } finally {
      setAdding(false);
    }
  }

  async function removeAdmin() {
    if (!pendingRemoval) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(
        `/api/superadmins?email=${encodeURIComponent(pendingRemoval)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setRemoveError(await readApiError(res));
        return;
      }
      setPendingRemoval(null);
      router.refresh();
    } catch {
      setRemoveError(NETWORK_ERROR);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="section-title">Super admin accounts</h3>
        <p className="mt-1 text-sm text-slate-400">
          These emails have full access to everything: they manage every club and
          its tournaments, players and rankings, assign club managers, view the
          activity log — and can add or remove other super admins. Grant this
          role sparingly.
        </p>
        <div className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
          {emails.map((email) => {
            const isDefault = email === defaultEmail;
            const isViewer = email === viewerEmail;
            return (
              <div
                key={email}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-white">
                    {email}
                  </span>
                  {isDefault && <Badge tone="volt">default</Badge>}
                  {isViewer && <Badge tone="slate">you</Badge>}
                </div>
                {isDefault ? (
                  <span className="text-xs text-slate-500">
                    Built-in — cannot be removed
                  </span>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setRemoveError(null);
                      setPendingRemoval(email);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="section-title">Add a super admin</h3>
        <p className="mt-1 text-sm text-slate-400">
          The account with this email gets full access immediately after signing
          in.
        </p>
        <form onSubmit={addAdmin} className="mt-4 flex flex-wrap gap-2 sm:flex-nowrap">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="admin@example.com"
            aria-label="New super admin email"
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={adding}>
            {adding && <Spinner className="h-3.5 w-3.5" />}
            Add super admin
          </Button>
        </form>
        <ErrorText>{addError}</ErrorText>
      </Card>

      <Modal
        open={pendingRemoval !== null}
        onClose={closeRemoveModal}
        title="Remove super admin?"
        footer={
          <>
            <Button variant="secondary" onClick={closeRemoveModal} disabled={removing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={removeAdmin} disabled={removing}>
              {removing && <Spinner className="h-3.5 w-3.5" />}
              Remove access
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{pendingRemoval}</span> will
          immediately lose super admin access — they will no longer be able to
          manage clubs, assign managers or view the activity log. Any club
          manager roles they hold via club manager emails are not affected.
        </p>
        <ErrorText>{removeError}</ErrorText>
      </Modal>
    </div>
  );
}
