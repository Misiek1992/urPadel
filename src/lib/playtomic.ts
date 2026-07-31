// Minimal client for Playtomic's Third-Party API (https://third-party.playtomic.io/).
// There is no dedicated "tournaments" endpoint — a tournament is a group of
// `Booking` records with booking_type "TOURNAMENT" that share one
// `activity_id` (one booking per court/resource the tournament occupies).
// This module fetches those bookings and groups them into tournaments with
// a unioned player roster. It never sees scores or bracket structure —
// Playtomic's API doesn't expose either.

const TOKEN_URL = "https://thirdparty.playtomic.io/api/v1/oauth/token";
const BOOKINGS_URL = "https://thirdparty.playtomic.io/api/v1/bookings";
const PAGE_SIZE = 100;
const MAX_PAGES = 10; // runaway guard — a club's tournament count in a ~37-day window is small

export class PlaytomicError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface PlaytomicCredentials {
  clientId: string;
  secret: string;
  tenantId: string;
}

export interface PlaytomicPlayer {
  name: string;
  email?: string;
}

export interface PlaytomicTournament {
  activityId: string;
  name: string;
  date: string;
  players: PlaytomicPlayer[];
}

interface RawParticipant {
  participant_id?: string;
  name?: string;
  email?: string;
}

interface RawBooking {
  activity_id?: string;
  activity_name?: string;
  booking_start_date?: string;
  participant_info?: {
    participants?: RawParticipant[];
  };
}

/** `YYYY-MM-DDTHH:MM:SS`, matching the format Playtomic's Bookings endpoint expects. */
function formatPlaytomicDate(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/** Exchanges client_id/secret for a 1-hour Bearer token. */
export async function getPlaytomicToken(clientId: string, secret: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, secret }),
    });
  } catch {
    throw new PlaytomicError("Could not reach Playtomic. Please try again.");
  }
  if (res.status === 401) {
    throw new PlaytomicError("Playtomic rejected the Client ID or secret.", 401);
  }
  if (!res.ok) {
    throw new PlaytomicError(`Playtomic authentication failed (status ${res.status}).`, res.status);
  }
  const data = (await res.json().catch(() => null)) as { token?: string } | null;
  if (!data?.token) throw new PlaytomicError("Playtomic did not return a token.");
  return data.token;
}

async function fetchTournamentBookings(
  token: string,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<RawBooking[]> {
  const bookings: RawBooking[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(BOOKINGS_URL);
    url.searchParams.set("tenant_id", tenantId);
    url.searchParams.set("booking_type", "TOURNAMENT");
    url.searchParams.set("start_booking_date", startDate);
    url.searchParams.set("end_booking_date", endDate);
    url.searchParams.set("size", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));

    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new PlaytomicError("Could not reach Playtomic. Please try again.");
    }
    if (!res.ok) {
      throw new PlaytomicError(
        `Playtomic returned an error (status ${res.status}) while listing bookings.`,
        res.status
      );
    }
    // The exact pagination envelope isn't fully confirmed from docs alone —
    // handle both a bare array and a {data, has_more} wrapper defensively.
    const body = (await res.json().catch(() => null)) as
      | RawBooking[]
      | { data?: RawBooking[]; has_more?: boolean }
      | null;
    const pageItems = Array.isArray(body) ? body : (body?.data ?? []);
    bookings.push(...pageItems);
    const hasMore = !Array.isArray(body) && Boolean(body?.has_more);
    if (!hasMore || pageItems.length < PAGE_SIZE) break;
  }
  return bookings;
}

/**
 * Groups tournament bookings by `activity_id` into one entry per tournament:
 * the earliest booking date, and the union of participants across every
 * court/resource booking that shares the activity. Pure — no network — so
 * it's directly unit-testable with fixture data.
 */
export function groupTournamentBookings(bookings: RawBooking[]): PlaytomicTournament[] {
  const groups = new Map<
    string,
    { name: string; date: string; players: Map<string, PlaytomicPlayer> }
  >();

  for (const booking of bookings) {
    // Only tournament bookings with multiple resources carry activity_id per
    // Playtomic's docs; skip anything without one rather than crash.
    if (!booking.activity_id || !booking.booking_start_date) continue;
    let group = groups.get(booking.activity_id);
    if (!group) {
      group = {
        name: booking.activity_name?.trim() || "Untitled tournament",
        date: booking.booking_start_date,
        players: new Map(),
      };
      groups.set(booking.activity_id, group);
    } else if (booking.booking_start_date < group.date) {
      group.date = booking.booking_start_date;
    }
    for (const p of booking.participant_info?.participants ?? []) {
      const name = p.name?.trim();
      if (!name) continue;
      const key = p.participant_id ?? `${name.toLowerCase()}|${p.email ?? ""}`;
      if (!group.players.has(key)) {
        group.players.set(key, { name, email: p.email?.trim() || undefined });
      }
    }
  }

  return Array.from(groups.entries())
    .map(([activityId, g]) => ({
      activityId,
      name: g.name,
      date: g.date,
      players: Array.from(g.players.values()),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Fetches and groups this club's Playtomic tournaments within the given date window. */
export async function fetchPlaytomicTournaments(
  creds: PlaytomicCredentials,
  opts: { daysBack: number; daysForward: number }
): Promise<PlaytomicTournament[]> {
  const token = await getPlaytomicToken(creds.clientId, creds.secret);
  const now = Date.now();
  const startDate = formatPlaytomicDate(new Date(now - opts.daysBack * 86_400_000));
  const endDate = formatPlaytomicDate(new Date(now + opts.daysForward * 86_400_000));
  const bookings = await fetchTournamentBookings(token, creds.tenantId, startDate, endDate);
  return groupTournamentBookings(bookings);
}
