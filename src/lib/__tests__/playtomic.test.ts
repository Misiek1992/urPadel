import { describe, expect, it } from "vitest";
import { groupTournamentBookings } from "../playtomic";

describe("groupTournamentBookings", () => {
  it("groups multi-resource bookings sharing an activity_id into one tournament", () => {
    const tournaments = groupTournamentBookings([
      {
        activity_id: "act-1",
        activity_name: "Friday Americano",
        booking_start_date: "2026-08-01T18:00:00",
        participant_info: {
          participants: [
            { participant_id: "p1", name: "Anna", email: "anna@example.com" },
            { participant_id: "p2", name: "Piotr" },
          ],
        },
      },
      {
        activity_id: "act-1",
        activity_name: "Friday Americano",
        booking_start_date: "2026-08-01T19:00:00",
        participant_info: {
          participants: [
            { participant_id: "p3", name: "Marta" },
            { participant_id: "p4", name: "Tomek" },
          ],
        },
      },
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
      { activity_id: "act-1", activity_name: "X", booking_start_date: "2026-08-02T09:00:00" },
      { activity_id: "act-1", activity_name: "X", booking_start_date: "2026-08-01T09:00:00" },
      { activity_id: "act-1", activity_name: "X", booking_start_date: "2026-08-03T09:00:00" },
    ]);
    expect(tournaments[0].date).toBe("2026-08-01T09:00:00");
  });

  it("dedupes the same participant appearing in multiple bookings of the group", () => {
    const tournaments = groupTournamentBookings([
      {
        activity_id: "act-1",
        activity_name: "X",
        booking_start_date: "2026-08-01T09:00:00",
        participant_info: { participants: [{ participant_id: "p1", name: "Anna" }] },
      },
      {
        activity_id: "act-1",
        activity_name: "X",
        booking_start_date: "2026-08-01T10:00:00",
        participant_info: { participants: [{ participant_id: "p1", name: "Anna" }] },
      },
    ]);
    expect(tournaments[0].players).toHaveLength(1);
  });

  it("dedupes participants without a participant_id by name+email", () => {
    const tournaments = groupTournamentBookings([
      {
        activity_id: "act-1",
        activity_name: "X",
        booking_start_date: "2026-08-01T09:00:00",
        participant_info: { participants: [{ name: "Guest Player" }] },
      },
      {
        activity_id: "act-1",
        activity_name: "X",
        booking_start_date: "2026-08-01T10:00:00",
        participant_info: { participants: [{ name: "Guest Player" }] },
      },
    ]);
    expect(tournaments[0].players).toHaveLength(1);
  });

  it("separates two distinct tournaments (different activity_id)", () => {
    const tournaments = groupTournamentBookings([
      { activity_id: "act-1", activity_name: "A", booking_start_date: "2026-08-01T09:00:00" },
      { activity_id: "act-2", activity_name: "B", booking_start_date: "2026-08-02T09:00:00" },
    ]);
    expect(tournaments).toHaveLength(2);
    expect(tournaments.map((t) => t.name).sort()).toEqual(["A", "B"]);
  });

  it("skips bookings missing activity_id or booking_start_date rather than throwing", () => {
    const tournaments = groupTournamentBookings([
      { activity_name: "No activity id", booking_start_date: "2026-08-01T09:00:00" },
      { activity_id: "act-1", activity_name: "No date" },
      { activity_id: "act-2", activity_name: "Valid", booking_start_date: "2026-08-01T09:00:00" },
    ]);
    expect(tournaments).toHaveLength(1);
    expect(tournaments[0].name).toBe("Valid");
  });

  it("falls back to a placeholder name when activity_name is blank", () => {
    const tournaments = groupTournamentBookings([
      { activity_id: "act-1", booking_start_date: "2026-08-01T09:00:00" },
    ]);
    expect(tournaments[0].name).toBe("Untitled tournament");
  });

  it("returns an empty list for no bookings", () => {
    expect(groupTournamentBookings([])).toEqual([]);
  });
});
