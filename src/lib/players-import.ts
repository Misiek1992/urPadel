// Parses player lists pasted or uploaded from Playtomic exports, CSV files or
// plain text (one name per line). Pure function — usable on client and server.

const NAME_HEADERS = [
  "full name",
  "fullname",
  "name",
  "player",
  "player name",
  "players",
  "nombre",
  "nombre completo",
  "imię i nazwisko",
  "imie i nazwisko",
  "gracz",
  "zawodnik",
];

function splitLine(line: string, delim: string | undefined): string[] {
  if (!delim) return [line];
  return line
    .split(delim)
    .map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
}

export function parsePlayersText(raw: string): string[] {
  const text = raw.replace(/^﻿/, "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Detect the delimiter from the first data line; semicolon and tab beat
  // comma so that "Kowalski, Adam"-style single-column lists survive when the
  // rest of the file uses ; or tab.
  const delim = [";", "\t", ","].find((d) => lines[0].includes(d));

  const rows = lines.map((l) => splitLine(l, delim));

  let nameIdx = 0;
  let start = 0;
  const header = rows[0].map((c) => c.toLowerCase());
  const headerIdx = header.findIndex((h) => NAME_HEADERS.includes(h));
  if (headerIdx !== -1) {
    nameIdx = headerIdx;
    start = 1;
  }

  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(start)) {
    const name = (row[nameIdx] ?? "").trim();
    if (!name) continue;
    // Skip obvious non-name cells (bare emails, numbers)
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) continue;
    if (/^\d+$/.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}
