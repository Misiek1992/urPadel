import { describe, expect, it } from "vitest";
import { groupTournamentBookings } from "../playtomic";

// Every real tournament booking carries booking_type "TOURNAMENT"; the helper
// keeps the fixtures focused on the field under test.
function tour(b: Record<string, unknown>) {
  return { booking_type: "TOURNAMENT", ...b };
}

describe("groupTournamentBookings", () => {
  it("groups multi-resource bookings sharing an activity_id into one tournament", () => {
    const tournaments = groupTournamentBookings([
      tour({
        activity_id: "act-1",
        activity_name: "Friday Americano",
        booking_start_date: "2026-08-01T18:00:00",
        participant_info: {
          participants: [
            { participant_id: "p1", name: "Anna", email: "anna@example.com" },
            { participant_id: "p2", name: "Piotr" },
          ],
        },
      }),
      tour({
        activity_id: "act-1",
        activity_name: "Friday Americano",
        booking_start_date: "2026-08-01T19:00:00",
        participant_info: {
          participants: [
            { participant_id: "p3", name: "Marta" },
            { participant_id: "p4", name: "Tomek" },
          ],
        },
      }),
    ]);

    expect(tournaments).toHaveLength(1);
    expect(tournaments[0].activityId).toBe("act-1");
    expect(tournaments[0].name).toBe("Friday Americano");
    expect(tournaments[0].date).toBe("2026-08-01T18:00:00");
    expect(tournaments[0].players.map((p) => p.name).sort()).toEqual([
      "Anna",
      "Marta",
      "Piotr",
      "Tomek",
    ]);
    expect(tournaments[0].players.find((p) => p.name === "Anna")?.email).toBe(
      "anna@example.com"
    );
  });

  it("takes the earliest booking_start_date across the group as the tournament date", () => {
    const tournaments = groupTournamentBookings([
      tour({ activity_id: "act-1", activity_name: "X", booking_start_date: "2026-08-02T09:00:00" }),
      tour({ activity_id: "act-1", activity_name: "X", booking_start_date: "2026-08-01T09:00:00" }),
      tour({ activity_id: "act-1", activity_name: "X", booking_start_date: "2026-08-03T09:00:00" }),
    ]);
    expect(tournaments[0].date).toBe("2026-08-01T09:00:00");
  });

  it("dedupes the same participant appearing in multiple bookings of the group", () => {
    const tournaments = groupTournamentBookings([
      tour({
        activity_id: "act-1",
        activity_name: "X",
        booking_start_date: "2026-08-01T09:00:00",
        participant_info: { participants: [{ participant_id: "p1", name: "Anna" }] },
      }),
      tour({
        activity_id: "act-1",
        activity_name: "X",
        booking_start_date: "2026-08-01T10:00:00",
        participant_info: { participants: [{ participant_id: "p1", name: "Anna" }] },
      }),
    ]);
    expect(tournaments[0].players).toHaveLength(1);
  });

  it("dedupes participants without a participant_id by name+email", () => {
    const tournaments = groupTournamentBookings([
      tour({
        activity_id: "act-1",
        activity_name: "X",
        booking_start_date: "2026-08-01T09:00:00",
        participant_info: { participants: [{ name: "Guest Player" }] },
      }),
      tour({
        activity_id: "act-1",
        activity_name: "X",
        booking_start_date: "2026-08-01T10:00:00",
        participant_info: { participants: [{ name: "Guest Player" }] },
      }),
    ]);
    expect(tournaments[0].players).toHaveLength(1);
  });

  it("separates two distinct tournaments (different activity_id)", () => {
    const tournaments = groupTournamentBookings([
      tour({ activity_id: "act-1", activity_name: "A", booking_start_date: "2026-08-01T09:00:00" }),
      tour({ activity_id: "act-2", activity_name: "B", booking_start_date: "2026-08-02T09:00:00" }),
    ]);
    expect(tournaments).toHaveLength(2);
    expect(tournaments.map((t) => t.name).sort()).toEqual(["A", "B"]);
  });

  it("skips bookings missing activity_id or booking_start_date rather than throwing", () => {
    const tournaments = groupTournamentBookings([
      tour({ activity_name: "No activity id", booking_start_date: "2026-08-01T09:00:00" }),
      tour({ activity_id: "act-1", activity_name: "No date" }),
      tour({ activity_id: "act-2", activity_name: "Valid", booking_start_date: "2026-08-01T09:00:00" }),
    ]);
    expect(tournaments).toHaveLength(1);
    expect(tournaments[0].name).toBe("Valid");
  });

  it("excludes non-TOURNAMENT activities even though they also carry an activity_id", () => {
    // PUBLIC_CLASS events (Padel Intro, Pilates…) have an activity_id too, so
    // activity_id presence alone must NOT qualify something as a tournament.
    const tournaments = groupTournamentBookings([
      {
        booking_type: "PUBLIC_CLASS",
        activity_id: "class-1",
        activity_name: "Padel Intro by Padel Spot",
        booking_start_date: "2026-08-01T09:00:00",
      },
      tour({ activity_id: "act-1", activity_name: "Real Tournament", booking_start_date: "2026-08-01T09:00:00" }),
    ]);
    expect(tournaments).toHaveLength(1);
    expect(tournaments[0].name).toBe("Real Tournament");
  });

  it("excludes a fully-canceled tournament", () => {
    const tournaments = groupTournamentBookings([
      {
        booking_type: "TOURNAMENT",
        status: "CANCELED",
        activity_id: "act-1",
        activity_name: "Canceled Americano",
        booking_start_date: "2026-08-01T09:00:00",
      },
      {
        booking_type: "TOURNAMENT",
        status: "CANCELED",
        activity_id: "act-1",
        activity_name: "Canceled Americano",
        booking_start_date: "2026-08-01T10:00:00",
      },
    ]);
    expect(tournaments).toHaveLength(0);
  });

  it("keeps a tournament's live bookings when only some resources were canceled", () => {
    const tournaments = groupTournamentBookings([
      {
        booking_type: "TOURNAMENT",
        status: "CANCELED",
        activity_id: "act-1",
        activity_name: "Mostly On",
        booking_start_date: "2026-08-01T09:00:00",
        participant_info: { participants: [{ participant_id: "p1", name: "Dropped" }] },
      },
      {
        booking_type: "TOURNAMENT",
        status: "PENDING",
        activity_id: "act-1",
        activity_name: "Mostly On",
        booking_start_date: "2026-08-01T10:00:00",
        participant_info: { participants: [{ participant_id: "p2", name: "Kept" }] },
      },
    ]);
    expect(tournaments).toHaveLength(1);
    expect(tournaments[0].players.map((p) => p.name)).toEqual(["Kept"]);
  });

  it("keeps finished tournaments (only CANCELED is excluded)", () => {
    const tournaments = groupTournamentBookings([
      {
        booking_type: "TOURNAMENT",
        status: "FINISHED",
        activity_id: "act-1",
        activity_name: "Done Americano",
        booking_start_date: "2026-07-25T09:00:00",
      },
    ]);
    expect(tournaments).toHaveLength(1);
  });

  it("falls back to a placeholder name when activity_name is blank", () => {
    const tournaments = groupTournamentBookings([
      tour({ activity_id: "act-1", booking_start_date: "2026-08-01T09:00:00" }),
    ]);
    expect(tournaments[0].name).toBe("Untitled tournament");
  });

  it("returns an empty list for no bookings", () => {
    expect(groupTournamentBookings([])).toEqual([]);
  });
});
