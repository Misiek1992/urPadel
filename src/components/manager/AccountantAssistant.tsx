"use client";

// Accountant Assistant: upload documents (images/PDF), OCR them with the club's
// configured engine, review extracted data in a table, and download a summary
// document. Per-document-type field parsing is a later seam — for now the table
// shows the raw extracted text and the summary groups by (not-yet-set) type.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorText, Spinner } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";
import { formatDate } from "@/components/public/helpers";
import { drawAccountantSummary } from "@/lib/accountant-summary";
import { jpegToPdf } from "@/lib/jpeg-pdf";
import type { AccountantDocumentJSON, OcrEngine } from "@/lib/types";

function statusTone(status: AccountantDocumentJSON["status"]): "volt" | "red" | "slate" {
  if (status === "parsed") return "volt";
  if (status === "failed") return "red";
  return "slate";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function AccountantAssistant({
  clubId,
  engine,
  documents,
}: {
  clubId: string;
  engine: OcrEngine;
  documents: AccountantDocumentJSON[];
}) {
  const t = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const dataBase64 = await readAsDataUrl(file);
      const res = await fetch(`/api/clubs/${clubId}/accountant/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64 }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setUploadError(data?.error ?? t("common.requestFailed", { status: res.status }));
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setUploadError(t("common.networkError"));
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/clubs/${clubId}/accountant/documents/${id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  function generateSummary() {
    const byType = new Map<string, AccountantDocumentJSON[]>();
    for (const doc of documents) {
      const key = doc.documentType || t("accountant.unclassified");
      const list = byType.get(key) ?? [];
      list.push(doc);
      byType.set(key, list);
    }
    const canvas = document.createElement("canvas");
    const { width, height } = drawAccountantSummary(canvas, {
      title: t("accountant.summaryDocTitle"),
      subtitle: t("accountant.summaryDocSubtitle", {
        count: documents.length,
        date: formatDate(new Date()),
      }),
      groups: [...byType.entries()].map(([type, docs]) => ({
        type,
        documents: docs.map((d) => ({
          fileName: d.fileName,
          status: t(`accountant.status_${d.status}`),
          date: formatDate(d.createdAt),
          chars: d.extractedText.length,
        })),
      })),
      footer: t("accountant.summaryDocFooter"),
      labels: {
        documentsInType: t("accountant.summaryInType"),
        chars: t("accountant.summaryChars"),
        empty: t("accountant.summaryEmptyGroup"),
      },
    });
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const pdf = jpegToPdf(bytes, width, height);
        const url = URL.createObjectURL(pdf);
        const a = document.createElement("a");
        a.href = url;
        a.download = "accountant-summary.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-volt-400/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">{t("accountant.uploadTitle")}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {t("accountant.uploadHint", { engine: t(`accountant.engine_${engine}`) })}
            </p>
          </div>
          {documents.length > 0 && (
            <Button variant="secondary" onClick={generateSummary}>
              {t("accountant.generateSummary")}
            </Button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            disabled={uploading}
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
            aria-label={t("accountant.uploadTitle")}
          />
          {uploading && <Spinner className="h-4 w-4 shrink-0" />}
        </div>
        <ErrorText>{uploadError}</ErrorText>
      </Card>

      <section>
        <h2 className="section-title mb-4">{t("accountant.documentsTitle")}</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">{t("accountant.noDocuments")}</p>
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t("accountant.colFile")}</th>
                  <th>{t("accountant.colType")}</th>
                  <th>{t("accountant.colStatus")}</th>
                  <th>{t("accountant.colEngine")}</th>
                  <th>{t("accountant.colDate")}</th>
                  <th>{t("accountant.colText")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc._id}>
                    <td className="font-semibold text-white">
                      <a
                        href={`/api/clubs/${clubId}/accountant/documents/${doc._id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-volt-300"
                      >
                        {doc.fileName}
                      </a>
                    </td>
                    <td className="text-slate-400">
                      {doc.documentType || t("accountant.unclassified")}
                    </td>
                    <td>
                      <span className={`badge badge-${statusTone(doc.status)}`}>
                        {t(`accountant.status_${doc.status}`)}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {t(`accountant.engine_${doc.ocrEngine}`)}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-400">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="max-w-xs">
                      {doc.status === "failed" || doc.status === "unsupported" ? (
                        <span className="text-xs text-slate-500">{doc.error ?? "—"}</span>
                      ) : (
                        <span className="line-clamp-2 text-xs text-slate-400">
                          {doc.extractedText
                            ? doc.extractedText.slice(0, 160)
                            : t("accountant.noText")}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc._id)}
                        disabled={deletingId !== null}
                        className="text-xs font-semibold text-slate-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingId === doc._id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          t("common.delete")
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
