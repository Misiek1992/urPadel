// Draws a branded, printable "accountant summary" onto a <canvas> — the same
// pure client-side canvas approach as scoreboard.ts, so the caller can convert
// it to JPEG and wrap it in a PDF via jpeg-pdf.ts. v1 lists the uploaded
// documents grouped by type (invoice/receipt/… once parsing lands, else
// "Unclassified") with a per-group count; it grows richer as structured
// parsed fields become available.

export interface SummaryDocRow {
  fileName: string;
  status: string;
  date: string;
  chars: number;
}

export interface SummaryGroup {
  type: string;
  documents: SummaryDocRow[];
}

export interface AccountantSummaryData {
  title: string;
  subtitle: string;
  groups: SummaryGroup[];
  footer: string;
  labels: { documentsInType: string; chars: string; empty: string };
}

const NAVY = "#050b17";
const NAVY_CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.12)";
const VOLT = "#d9f954";
const WHITE = "#ffffff";
const GRAY = "#94a3b8";
const GRAY_DIM = "#64748b";
const FONT = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';

const W = 1240;
const PAD = 64;
const HEADER_H = 170;
const GROUP_H = 46;
const ROW_H = 34;
const GROUP_GAP = 20;
const FOOTER_H = 90;

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT}`;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

/** Renders the summary; returns the canvas's logical pixel size (rendered at 2×). */
export function drawAccountantSummary(
  canvas: HTMLCanvasElement,
  data: AccountantSummaryData
): { width: number; height: number } {
  const bodyH = data.groups.reduce(
    (h, g) => h + GROUP_H + Math.max(1, g.documents.length) * ROW_H + GROUP_GAP,
    0
  );
  const H = HEADER_H + bodyH + FOOTER_H + PAD;

  const SCALE = 2;
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "middle";

  // Background
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.font = font(800, 34);
  ctx.fillStyle = VOLT;
  ctx.fillText("ur", PAD, 60);
  const urW = ctx.measureText("ur").width;
  ctx.fillStyle = WHITE;
  ctx.fillText("Padel", PAD + urW, 60);

  ctx.font = font(800, 44);
  ctx.fillStyle = WHITE;
  ctx.fillText(truncate(ctx, data.title, W - PAD * 2), PAD, 116);
  ctx.font = font(600, 20);
  ctx.fillStyle = GRAY;
  ctx.fillText(truncate(ctx, data.subtitle, W - PAD * 2), PAD, 150);

  // Groups
  let y = HEADER_H;
  const colName = PAD + 12;
  const colStatus = W - PAD - 360;
  const colChars = W - PAD - 190;
  const colDate = W - PAD - 12;

  for (const group of data.groups) {
    // Group header band
    ctx.fillStyle = NAVY_CARD;
    ctx.fillRect(PAD, y, W - PAD * 2, GROUP_H);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, y, W - PAD * 2, GROUP_H);
    ctx.font = font(800, 20);
    ctx.fillStyle = VOLT;
    ctx.fillText(group.type, colName, y + GROUP_H / 2);
    ctx.textAlign = "right";
    ctx.font = font(600, 15);
    ctx.fillStyle = GRAY;
    ctx.fillText(
      data.labels.documentsInType.replace("{count}", String(group.documents.length)),
      colDate,
      y + GROUP_H / 2
    );
    ctx.textAlign = "left";
    y += GROUP_H;

    if (group.documents.length === 0) {
      ctx.font = font(500, 15);
      ctx.fillStyle = GRAY_DIM;
      ctx.fillText(data.labels.empty, colName, y + ROW_H / 2);
      y += ROW_H;
    } else {
      group.documents.forEach((doc, i) => {
        if (i % 2 === 1) {
          ctx.fillStyle = "rgba(255,255,255,0.02)";
          ctx.fillRect(PAD, y, W - PAD * 2, ROW_H);
        }
        ctx.font = font(600, 15);
        ctx.fillStyle = WHITE;
        ctx.fillText(truncate(ctx, doc.fileName, colStatus - colName - 16), colName, y + ROW_H / 2);
        ctx.font = font(500, 14);
        ctx.fillStyle = GRAY;
        ctx.fillText(doc.status, colStatus, y + ROW_H / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = GRAY;
        ctx.fillText(
          data.labels.chars.replace("{count}", String(doc.chars)),
          colChars,
          y + ROW_H / 2
        );
        ctx.fillStyle = GRAY_DIM;
        ctx.fillText(doc.date, colDate, y + ROW_H / 2);
        ctx.textAlign = "left";
        y += ROW_H;
      });
    }
    y += GROUP_GAP;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.font = font(600, 16);
  ctx.fillStyle = GRAY_DIM;
  ctx.fillText(data.footer, W / 2, H - FOOTER_H / 2);
  ctx.textAlign = "left";

  return { width: W * SCALE, height: H * SCALE };
}
