// Draws branded, share-ready posters onto a <canvas> — used for the JPEG and
// PDF exports of a finished tournament's results and of a club's rolling
// ranking. Pure client-side canvas drawing (no DOM capture libraries), so the
// output is deterministic, crisp (rendered at 2×), and always matches the
// urPadel navy/volt brand.

export interface ScoreboardRow {
  position: number;
  name: string;
  players?: string[];
  roundPoints: (number | null)[];
  total: number;
}

export interface ScoreboardData {
  title: string;
  subtitle: string;
  roundLabels: string[];
  rows: ScoreboardRow[];
  labels: { position: string; player: string; total: string };
  footer: string;
}

export interface RankingPosterRow {
  position: number;
  name: string;
  tournamentsPlayed: number;
  total: number;
}

export interface RankingPosterData {
  title: string;
  subtitle: string;
  rows: RankingPosterRow[];
  labels: { position: string; player: string; tournaments: string; total: string };
  footer: string;
}

const NAVY = "#050b17";
const NAVY_CARD = "rgba(255,255,255,0.045)";
const BORDER = "rgba(255,255,255,0.12)";
const VOLT = "#d9f954";
const VOLT_SOFT = "#eaff8f";
const WHITE = "#ffffff";
const GRAY = "#94a3b8";
const GRAY_DIM = "#64748b";
const FONT = '"Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MEDALS = ["🥇", "🥈", "🥉"];

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT}`;
}

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The racket-and-ball brand mark, drawn natively at (x, y) with height ~s. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const u = s / 48; // the SVG viewBox is 48×48
  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  ctx.translate(21 * u, 20 * u);
  ctx.rotate((-24 * Math.PI) / 180);
  ctx.translate(-21 * u, -20 * u);
  const grad = ctx.createLinearGradient(8 * u, 1 * u, 34 * u, 34 * u);
  grad.addColorStop(0, VOLT_SOFT);
  grad.addColorStop(1, "#c3e830");
  ctx.fillStyle = grad;
  roundRect(ctx, 8 * u, 1 * u, 26 * u, 33 * u, 13 * u);
  ctx.fill();
  ctx.fillStyle = "#0a1425";
  for (const cy of [11, 17, 23]) {
    for (const cx of [16, 21, 26]) {
      ctx.beginPath();
      ctx.arc(cx * u, cy * u, 1.7 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = grad;
  roundRect(ctx, 18 * u, 33 * u, 6 * u, 12 * u, 3 * u);
  ctx.fill();
  ctx.restore();
  const ball = ctx.createLinearGradient(31 * u, 31 * u, 45 * u, 45 * u);
  ball.addColorStop(0, "#7cc4ff");
  ball.addColorStop(1, "#2f7de1");
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(38 * u, 38 * u, 6.5 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0a1425";
  ctx.lineWidth = 1.3 * u;
  ctx.beginPath();
  ctx.arc(38 * u, 33.2 * u, 5.2 * u, Math.PI * 0.25, Math.PI * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(38 * u, 42.8 * u, 5.2 * u, Math.PI * 1.25, Math.PI * 1.75);
  ctx.stroke();
  ctx.restore();
}

/** Background wash + brand mark/wordmark + title/subtitle. Shared by both poster types. */
function drawHeader(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  PAD: number,
  title: string,
  subtitle: string
): void {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  let glow = ctx.createRadialGradient(W * 0.88, 0, 0, W * 0.88, 0, 700);
  glow.addColorStop(0, "rgba(217,249,84,0.10)");
  glow.addColorStop(1, "rgba(217,249,84,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  glow = ctx.createRadialGradient(0, H * 0.25, 0, 0, H * 0.25, 800);
  glow.addColorStop(0, "rgba(47,125,225,0.13)");
  glow.addColorStop(1, "rgba(47,125,225,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawMark(ctx, PAD, 46, 64);
  ctx.font = font(800, 34);
  ctx.fillStyle = VOLT;
  ctx.fillText("ur", PAD + 78, 78);
  const urW = ctx.measureText("ur").width;
  ctx.fillStyle = WHITE;
  ctx.fillText("Padel", PAD + 78 + urW, 78);

  ctx.font = font(800, 54);
  ctx.fillStyle = WHITE;
  ctx.fillText(truncate(ctx, title, W - PAD * 2), PAD, 160);
  ctx.font = font(600, 24);
  ctx.fillStyle = GRAY;
  ctx.fillText(truncate(ctx, subtitle, W - PAD * 2), PAD, 204);
}

/** Top-3 podium cards (gold centered, silver/bronze either side). Returns the new y offset. */
function drawPodium(
  ctx: CanvasRenderingContext2D,
  W: number,
  PAD: number,
  y: number,
  podiumH: number,
  entries: { name: string; total: number }[]
): number {
  if (podiumH === 0) return y;
  const gap = 24;
  const cardW = (W - PAD * 2 - gap * 2) / 3;
  const order = [1, 0, 2]; // silver, gold, bronze — gold in the middle
  order.forEach((rowIdx, i) => {
    const row = entries[rowIdx];
    const x = PAD + i * (cardW + gap);
    const lift = rowIdx === 0 ? 0 : 18;
    const cardH = podiumH - 32 - lift;
    const cy = y + lift;
    ctx.fillStyle = rowIdx === 0 ? "rgba(217,249,84,0.09)" : NAVY_CARD;
    roundRect(ctx, x, cy, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = rowIdx === 0 ? "rgba(217,249,84,0.45)" : BORDER;
    ctx.lineWidth = 2;
    roundRect(ctx, x, cy, cardW, cardH, 18);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = font(400, 40);
    ctx.fillStyle = WHITE;
    ctx.fillText(MEDALS[rowIdx], x + cardW / 2, cy + 38);
    ctx.font = font(700, 27);
    ctx.fillText(truncate(ctx, row.name, cardW - 40), x + cardW / 2, cy + 82);
    ctx.font = font(800, 34);
    ctx.fillStyle = VOLT;
    ctx.fillText(String(row.total), x + cardW / 2, cy + cardH - 34);
    ctx.textAlign = "left";
  });
  return y + podiumH;
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  W: number,
  y: number,
  footerH: number,
  text: string
): void {
  const fy = y + footerH / 2 + 8;
  ctx.textAlign = "center";
  ctx.font = font(600, 21);
  ctx.fillStyle = GRAY_DIM;
  ctx.fillText(text, W / 2, fy);
  ctx.textAlign = "left";
}

/**
 * Renders the results poster and returns its logical pixel dimensions. The
 * canvas is internally rendered at 2× for print/retina quality.
 */
export function drawScoreboard(
  canvas: HTMLCanvasElement,
  data: ScoreboardData
): { width: number; height: number } {
  const W = 1560;
  const PAD = 72;
  const teamMode = data.rows.some((r) => r.players && r.players.length > 0);
  const rowH = teamMode ? 76 : 58;
  const tableHeaderH = 58;
  const podiumH = data.rows.length >= 3 ? 196 : 0;
  const headerH = 236;
  const tableH = tableHeaderH + data.rows.length * rowH;
  const footerH = 110;
  const H = headerH + podiumH + tableH + footerH + 56;

  const SCALE = 2;
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "middle";

  drawHeader(ctx, W, H, PAD, data.title, data.subtitle);
  let y = drawPodium(ctx, W, PAD, headerH, podiumH, data.rows);

  // ---- table ----
  const nRounds = data.roundLabels.length;
  const posW = 76;
  const totalW = 130;
  const roundW = Math.min(84, Math.max(52, (W - PAD * 2 - posW - totalW - 380) / Math.max(nRounds, 1)));
  const playerW = W - PAD * 2 - posW - totalW - roundW * nRounds;
  const tableX = PAD;
  const tableW = W - PAD * 2;

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  roundRect(ctx, tableX, y, tableW, tableH, 16);
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, tableX, y, tableW, tableH, 16);
  ctx.stroke();

  // header row
  ctx.font = font(700, 19);
  ctx.fillStyle = GRAY;
  const headerMid = y + tableHeaderH / 2;
  ctx.fillText(data.labels.position, tableX + 28, headerMid);
  ctx.fillText(data.labels.player, tableX + posW + 16, headerMid);
  ctx.textAlign = "center";
  data.roundLabels.forEach((label, i) => {
    ctx.fillText(
      label,
      tableX + posW + playerW + roundW * i + roundW / 2,
      headerMid
    );
  });
  ctx.textAlign = "right";
  ctx.fillText(data.labels.total, tableX + tableW - 28, headerMid);
  ctx.textAlign = "left";
  ctx.strokeStyle = BORDER;
  ctx.beginPath();
  ctx.moveTo(tableX, y + tableHeaderH);
  ctx.lineTo(tableX + tableW, y + tableHeaderH);
  ctx.stroke();

  // rows
  data.rows.forEach((row, i) => {
    const ry = y + tableHeaderH + i * rowH;
    const mid = ry + rowH / 2;
    if (row.position <= 3) {
      ctx.fillStyle = "rgba(217,249,84,0.05)";
      ctx.fillRect(tableX + 2, ry, tableW - 4, rowH);
    } else if (i % 2 === 1) {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(tableX + 2, ry, tableW - 4, rowH);
    }
    // position / medal
    if (row.position <= 3) {
      ctx.font = font(400, 26);
      ctx.fillStyle = WHITE;
      ctx.fillText(MEDALS[row.position - 1], tableX + 22, mid);
    } else {
      ctx.font = font(700, 22);
      ctx.fillStyle = GRAY_DIM;
      ctx.fillText(String(row.position), tableX + 30, mid);
    }
    // name (+ team players)
    ctx.fillStyle = WHITE;
    ctx.font = font(700, 24);
    if (row.players && row.players.length > 0) {
      ctx.fillText(truncate(ctx, row.name, playerW - 32), tableX + posW + 16, mid - 13);
      ctx.font = font(500, 18);
      ctx.fillStyle = GRAY;
      ctx.fillText(
        truncate(ctx, row.players.join(" · "), playerW - 32),
        tableX + posW + 16,
        mid + 15
      );
    } else {
      ctx.fillText(truncate(ctx, row.name, playerW - 32), tableX + posW + 16, mid);
    }
    // round points
    ctx.textAlign = "center";
    row.roundPoints.forEach((pts, ri) => {
      const cx = tableX + posW + playerW + roundW * ri + roundW / 2;
      if (pts == null) {
        ctx.font = font(500, 21);
        ctx.fillStyle = GRAY_DIM;
        ctx.fillText("–", cx, mid);
      } else {
        ctx.font = font(600, 22);
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(String(pts), cx, mid);
      }
    });
    ctx.textAlign = "right";
    ctx.font = font(800, 26);
    ctx.fillStyle = VOLT;
    ctx.fillText(String(row.total), tableX + tableW - 28, mid);
    ctx.textAlign = "left";
    if (i < data.rows.length - 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableX + 2, ry + rowH);
      ctx.lineTo(tableX + tableW - 2, ry + rowH);
      ctx.stroke();
    }
  });

  y += tableH;
  drawFooter(ctx, W, y, footerH, data.footer);

  return { width: W * SCALE, height: H * SCALE };
}

/**
 * Renders a club-ranking poster (# / player / tournaments played / points,
 * no per-round columns) and returns its logical pixel dimensions.
 */
export function drawRankingPoster(
  canvas: HTMLCanvasElement,
  data: RankingPosterData
): { width: number; height: number } {
  const W = 1560;
  const PAD = 72;
  const rowH = 58;
  const tableHeaderH = 58;
  const podiumH = data.rows.length >= 3 ? 196 : 0;
  const headerH = 236;
  const tableH = tableHeaderH + data.rows.length * rowH;
  const footerH = 110;
  const H = headerH + podiumH + tableH + footerH + 56;

  const SCALE = 2;
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "middle";

  drawHeader(ctx, W, H, PAD, data.title, data.subtitle);
  let y = drawPodium(ctx, W, PAD, headerH, podiumH, data.rows);

  // ---- table ----
  const posW = 76;
  const tournamentsW = 200;
  const totalW = 150;
  const playerW = W - PAD * 2 - posW - tournamentsW - totalW;
  const tableX = PAD;
  const tableW = W - PAD * 2;

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  roundRect(ctx, tableX, y, tableW, tableH, 16);
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, tableX, y, tableW, tableH, 16);
  ctx.stroke();

  // header row
  ctx.font = font(700, 19);
  ctx.fillStyle = GRAY;
  const headerMid = y + tableHeaderH / 2;
  ctx.fillText(data.labels.position, tableX + 28, headerMid);
  ctx.fillText(data.labels.player, tableX + posW + 16, headerMid);
  ctx.textAlign = "center";
  ctx.fillText(data.labels.tournaments, tableX + posW + playerW + tournamentsW / 2, headerMid);
  ctx.textAlign = "right";
  ctx.fillText(data.labels.total, tableX + tableW - 28, headerMid);
  ctx.textAlign = "left";
  ctx.strokeStyle = BORDER;
  ctx.beginPath();
  ctx.moveTo(tableX, y + tableHeaderH);
  ctx.lineTo(tableX + tableW, y + tableHeaderH);
  ctx.stroke();

  // rows
  data.rows.forEach((row, i) => {
    const ry = y + tableHeaderH + i * rowH;
    const mid = ry + rowH / 2;
    if (row.position <= 3) {
      ctx.fillStyle = "rgba(217,249,84,0.05)";
      ctx.fillRect(tableX + 2, ry, tableW - 4, rowH);
    } else if (i % 2 === 1) {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(tableX + 2, ry, tableW - 4, rowH);
    }
    if (row.position <= 3) {
      ctx.font = font(400, 26);
      ctx.fillStyle = WHITE;
      ctx.fillText(MEDALS[row.position - 1], tableX + 22, mid);
    } else {
      ctx.font = font(700, 22);
      ctx.fillStyle = GRAY_DIM;
      ctx.fillText(String(row.position), tableX + 30, mid);
    }
    ctx.fillStyle = WHITE;
    ctx.font = font(700, 24);
    ctx.fillText(truncate(ctx, row.name, playerW - 32), tableX + posW + 16, mid);
    ctx.textAlign = "center";
    ctx.font = font(600, 22);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(String(row.tournamentsPlayed), tableX + posW + playerW + tournamentsW / 2, mid);
    ctx.textAlign = "right";
    ctx.font = font(800, 26);
    ctx.fillStyle = VOLT;
    ctx.fillText(String(row.total), tableX + tableW - 28, mid);
    ctx.textAlign = "left";
    if (i < data.rows.length - 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableX + 2, ry + rowH);
      ctx.lineTo(tableX + tableW - 2, ry + rowH);
      ctx.stroke();
    }
  });

  y += tableH;
  drawFooter(ctx, W, y, footerH, data.footer);

  return { width: W * SCALE, height: H * SCALE };
}
