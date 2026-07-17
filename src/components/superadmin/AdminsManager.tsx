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
import { useT } from "@/components/i18n/LocaleProvider";

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
  const t = useT();
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
      setAddError(t("superadminAdmins.invalidEmail"));
      return;
    }
    if (emails.includes(email)) {
      setAddError(t("superadminAdmins.alreadyAdmin"));
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
        <h3 className="section-title">{t("superadminAdmins.accountsTitle")}</h3>
        <p className="mt-1 text-sm text-slate-400">
          {t("superadminAdmins.accountsHint")}
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
                  {isDefault && <Badge tone="volt">{t("superadminAdmins.default")}</Badge>}
                  {isViewer && <Badge tone="slate">{t("superadminAdmins.you")}</Badge>}
                </div>
                {isDefault ? (
                  <span className="text-xs text-slate-500">
                    {t("superadminAdmins.builtIn")}
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
                    {t("superadminAdmins.remove")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="section-title">{t("superadminAdmins.addTitle")}</h3>
        <p className="mt-1 text-sm text-slate-400">{t("superadminAdmins.addHint")}</p>
        <form onSubmit={addAdmin} className="mt-4 flex flex-wrap gap-2 sm:flex-nowrap">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={t("superadminAdmins.addPlaceholder")}
            aria-label={t("superadminAdmins.addAria")}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={adding}>
            {adding && <Spinner className="h-3.5 w-3.5" />}
            {t("superadminAdmins.addBtn")}
          </Button>
        </form>
        <ErrorText>{addError}</ErrorText>
      </Card>

      <Modal
        open={pendingRemoval !== null}
        onClose={closeRemoveModal}
        title={t("superadminAdmins.removeModalTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={closeRemoveModal} disabled={removing}>
              {t("superadminAdmins.cancel")}
            </Button>
            <Button variant="danger" onClick={removeAdmin} disabled={removing}>
              {removing && <Spinner className="h-3.5 w-3.5" />}
              {t("superadminAdmins.removeAccess")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {t("superadminAdmins.removeModalBody", { email: pendingRemoval ?? "" })}
        </p>
        <ErrorText>{removeError}</ErrorText>
      </Modal>
    </div>
  );
}
