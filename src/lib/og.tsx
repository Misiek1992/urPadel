// Shared brand chrome for Open Graph share-preview images (next/og
// ImageResponse, JSX rendered by satori — a much smaller subset of CSS than
// a browser: flex layout only, no grid, no shorthand `background` gradients
// with multiple stops beyond linear-gradient, no CSS variables).
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

const NAVY = "#050b17";
const NAVY_CARD = "rgba(255,255,255,0.045)";
const BORDER = "rgba(255,255,255,0.14)";
const VOLT = "#d9f954";
const VOLT_SOFT = "#eaff8f";
const WHITE = "#ffffff";
const GRAY = "#94a3b8";
const MEDALS = ["🥇", "🥈", "🥉"];

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]> | null = null;

/** Inter (static TTF, full Latin Extended coverage — Polish/Spanish diacritics render correctly). */
export function loadOgFonts() {
  if (!fontsPromise) {
    const dir = join(process.cwd(), "src/assets/fonts");
    fontsPromise = Promise.all([
      readFile(join(dir, "Inter-Regular.ttf")),
      readFile(join(dir, "Inter-Bold.ttf")),
    ]).then(([regular, bold]) => [
      { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
    ]);
  }
  return fontsPromise;
}

/** The padel racket-and-ball brand mark, built from flex/CSS shapes (no raw SVG — safer under satori). */
function BrandMark({ size = 40 }: { size?: number }) {
  const u = size / 40;
  return (
    <div style={{ display: "flex", width: size, height: size, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 4 * u,
          top: 0,
          width: 24 * u,
          height: 30 * u,
          borderRadius: 11 * u,
          background: `linear-gradient(135deg, ${VOLT_SOFT}, #c3e830)`,
          transform: "rotate(-24deg)",
          display: "flex",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
          gap: 2 * u,
          padding: 5 * u,
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 3 * u,
              height: 3 * u,
              borderRadius: 3 * u,
              background: "#0a1425",
              display: "flex",
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 15 * u,
          height: 15 * u,
          borderRadius: 15 * u,
          background: `linear-gradient(135deg, #7cc4ff, #2f7de1)`,
          display: "flex",
        }}
      />
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <BrandMark size={36} />
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
        <span style={{ color: VOLT }}>ur</span>
        <span style={{ color: WHITE }}>Padel</span>
      </div>
    </div>
  );
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "volt" | "blue";
}) {
  const colors = {
    slate: { bg: "rgba(255,255,255,0.08)", fg: GRAY },
    volt: { bg: "rgba(217,249,84,0.14)", fg: VOLT },
    blue: { bg: "rgba(59,130,246,0.16)", fg: "#93c5fd" },
  }[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "7px 16px",
        borderRadius: 999,
        background: colors.bg,
        color: colors.fg,
        fontSize: 22,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 64,
        background: `linear-gradient(135deg, ${NAVY} 0%, #0d1a30 100%)`,
        fontFamily: "Inter",
      }}
    >
      {children}
    </div>
  );
}

export function TournamentOgImage({
  name,
  clubName,
  formatLabel,
  statusLabel,
  isActive,
  podium,
}: {
  name: string;
  clubName: string | null;
  formatLabel: string;
  statusLabel: string;
  isActive: boolean;
  podium: { name: string; points: number }[];
}) {
  return (
    <Frame>
      <Wordmark />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: name.length > 28 ? 52 : 64,
            fontWeight: 700,
            color: WHITE,
            lineHeight: 1.1,
            maxWidth: 1040,
          }}
        >
          {name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {clubName && <Pill tone="slate">{clubName}</Pill>}
          <Pill tone="blue">{formatLabel}</Pill>
          <Pill tone={isActive ? "volt" : "slate"}>{statusLabel}</Pill>
        </div>
        {podium.length > 0 && (
          <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
            {podium.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "18px 28px",
                  borderRadius: 20,
                  background: NAVY_CARD,
                  border: `1px solid ${BORDER}`,
                  minWidth: 220,
                }}
              >
                <div style={{ display: "flex", fontSize: 30 }}>{MEDALS[i]}</div>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: WHITE, marginTop: 6 }}>
                  {row.name}
                </div>
                <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: VOLT, marginTop: 2 }}>
                  {row.points} pts
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>
  );
}

export function ClubOgImage({
  name,
  city,
  ranking,
}: {
  name: string;
  city: string | null;
  ranking: { position: number; playerName: string; total: number }[];
}) {
  return (
    <Frame>
      <Wordmark />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {city && (
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: VOLT, textTransform: "uppercase", letterSpacing: 2 }}>
              {city}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, color: WHITE, lineHeight: 1.1, maxWidth: 1040 }}>
            {name}
          </div>
        </div>
        {ranking.length > 0 && (
          <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
            {ranking.map((row) => (
              <div
                key={row.position}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "18px 28px",
                  borderRadius: 20,
                  background: NAVY_CARD,
                  border: `1px solid ${BORDER}`,
                  minWidth: 220,
                }}
              >
                <div style={{ display: "flex", fontSize: 30 }}>{MEDALS[row.position - 1]}</div>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: WHITE, marginTop: 6 }}>
                  {row.playerName}
                </div>
                <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: VOLT, marginTop: 2 }}>
                  {row.total} pts
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Frame>
  );
}
