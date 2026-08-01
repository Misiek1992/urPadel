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
// Runaway guard. The bookings endpoint returns ALL booking types (not just
// tournaments — the booking_type query param is not honoured), so a busy venue
// can have many pages in a ~37-day window; 20×100 = 2000 bookings is plenty.
const MAX_PAGES = 20;

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
  booking_type?: string;
  booking_start_date?: string;
  status?: string;
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
    // Playtomic returns a bare JSON array (not a {data, has_more} envelope),
    // sorted newest-first, PAGE_SIZE per page. Keep paging until a page comes
    // back short — that's the last page. (The previous code looked for a
    // has_more flag that never exists, so it stopped after page 0 and silently
    // dropped every booking older than the newest 100 — which hid near-term
    // tournaments at busy venues.)
    const body = (await res.json().catch(() => null)) as
      | RawBooking[]
      | { data?: RawBooking[] }
      | null;
    const pageItems = Array.isArray(body) ? body : (body?.data ?? []);
    bookings.push(...pageItems);
    if (pageItems.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) {
      console.warn(
        `[playtomic] Hit the ${MAX_PAGES}-page cap while listing bookings for tenant ${tenantId} — some may be omitted.`
      );
    }
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
    // The bookings feed mixes every type and the booking_type query param is
    // ignored server-side, so filter here. PUBLIC_CLASS events (Padel Intro,
    // Pilates, …) also carry an activity_id, so activity_id presence alone is
    // NOT enough to identify a tournament — require the type explicitly.
    if (booking.booking_type !== "TOURNAMENT") continue;
    // Skip canceled bookings — a fully-canceled activity then never forms a
    // group. (Mixed activities keep their still-live bookings.)
    if (booking.status === "CANCELED") continue;
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
