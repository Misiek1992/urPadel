"use client";

// Export & share panel for a finished tournament: downloads the results as a
// branded JPEG poster or PDF (both rendered from the same canvas), and builds
// a ready-to-paste message for the Playtomic tournament chat — copy to
// clipboard, or hand it to the native share sheet on mobile (which opens
// straight into apps like Playtomic or WhatsApp).

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";
import { drawScoreboard, type ScoreboardRow } from "@/lib/scoreboard";
import { jpegToPdf } from "@/lib/jpeg-pdf";

const MEDALS = ["🥇", "🥈", "🥉"];

export function ExportResults({
  title,
  subtitle,
  roundLabels,
  rows,
  labels,
  fileBase,
  resultsPath,
}: {
  title: string;
  subtitle: string;
  roundLabels: string[];
  rows: ScoreboardRow[];
  labels: { position: string; player: string; total: string };
  fileBase: string;
  resultsPath: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState<"pdf" | "jpeg" | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  function resultsUrl(): string {
    return `${window.location.origin}${resultsPath}`;
  }

  async function renderJpeg(): Promise<{ blob: Blob; w: number; h: number }> {
    const canvas = document.createElement("canvas");
    const { width, height } = drawScoreboard(canvas, {
      title,
      subtitle,
      roundLabels,
      rows,
      labels,
      footer: t("export.posterFooter", { url: resultsUrl().replace(/^https?:\/\//, "") }),
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.92
      )
    );
    return { blob, w: width, h: height };
  }

  function download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function downloadJpeg(): Promise<void> {
    setBusy("jpeg");
    try {
      const { blob } = await renderJpeg();
      download(blob, `${fileBase}.jpg`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf(): Promise<void> {
    setBusy("pdf");
    try {
      const { blob, w, h } = await renderJpeg();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      download(jpegToPdf(bytes, w, h), `${fileBase}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  function buildMessage(): string {
    const lines: string[] = [t("export.msgHeader", { name: title }), ""];
    for (const row of rows) {
      const medal = MEDALS[row.position - 1] ?? ` ${row.position}.`;
      lines.push(
        t("export.msgLine", { medal, name: row.name, points: row.total })
      );
    }
    lines.push("", t("export.msgFull", { url: resultsUrl() }));
    lines.push(`— ${t("export.msgFooter")}`);
    return lines.join("\n");
  }

  async function copyMessage(): Promise<void> {
    await navigator.clipboard.writeText(buildMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  }

  async function share(): Promise<void> {
    try {
      await navigator.share({ title, text: buildMessage() });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  return (
    <Card className="border-volt-400/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">{t("export.title")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("export.hint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={downloadPdf} disabled={busy !== null}>
            {busy === "pdf" ? t("export.preparing") : t("export.pdf")}
          </Button>
          <Button onClick={downloadJpeg} disabled={busy !== null}>
            {busy === "jpeg" ? t("export.preparing") : t("export.jpeg")}
          </Button>
          <Button variant="secondary" onClick={copyMessage}>
            {copied ? t("export.copied") : t("export.copyMessage")}
          </Button>
          {canShare && (
            <Button variant="secondary" onClick={share}>
              {t("export.share")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
