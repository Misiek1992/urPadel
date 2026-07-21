"use client";

// Export & share panel for a club's rolling ranking: downloads it as a
// branded JPEG poster or PDF, and builds a ready-to-paste message for the
// Playtomic/WhatsApp club chat — mirrors ExportResults.tsx, swapping the
// results table for the ranking poster (# / player / tournaments / points).

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";
import { drawRankingPoster, type RankingPosterRow } from "@/lib/scoreboard";
import { jpegToPdf } from "@/lib/jpeg-pdf";

const MEDALS = ["🥇", "🥈", "🥉"];

export function ExportRanking({
  title,
  subtitle,
  rows,
  fileBase,
  clubPath,
}: {
  title: string;
  subtitle: string;
  rows: RankingPosterRow[];
  fileBase: string;
  clubPath: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState<"pdf" | "jpeg" | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  function clubUrl(): string {
    return `${window.location.origin}${clubPath}`;
  }

  async function renderJpeg(): Promise<{ blob: Blob; w: number; h: number }> {
    const canvas = document.createElement("canvas");
    const { width, height } = drawRankingPoster(canvas, {
      title,
      subtitle,
      rows,
      labels: {
        position: t("clubPage.position"),
        player: t("clubPage.player"),
        tournaments: t("clubPage.tournamentsPlayed"),
        total: t("clubPage.points"),
      },
      footer: t("export.posterFooter", { url: clubUrl().replace(/^https?:\/\//, "") }),
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
    const lines: string[] = [t("exportRanking.msgHeader", { name: title }), ""];
    for (const row of rows.slice(0, 10)) {
      const medal = MEDALS[row.position - 1] ?? ` ${row.position}.`;
      lines.push(
        t("export.msgLine", { medal, name: row.name, points: row.total })
      );
    }
    lines.push("", t("exportRanking.msgFull", { url: clubUrl() }));
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
          <p className="mt-1 text-sm text-slate-400">{t("exportRanking.hint")}</p>
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
