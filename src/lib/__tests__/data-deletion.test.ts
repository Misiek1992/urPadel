import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { maskEmail, signDeletionToken, verifyDeletionToken } from "../data-deletion";

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("deletion token", () => {
  it("round-trips the (lowercased, trimmed) email", () => {
    const token = signDeletionToken("  Player@Example.com  ");
    expect(verifyDeletionToken(token)).toBe("player@example.com");
  });

  it("rejects an expired token", () => {
    const past = 1_000_000; // fixed "now" far in the past
    const token = signDeletionToken("a@b.com", past);
    // verify with a "now" beyond the 1h TTL
    expect(verifyDeletionToken(token, past + 60 * 60 * 1000 + 1)).toBeNull();
    // still valid just inside the window
    expect(verifyDeletionToken(token, past + 1000)).toBe("a@b.com");
  });

  it("rejects a tampered signature", () => {
    const token = signDeletionToken("a@b.com");
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [email, exp] = decoded.split(":");
    const forged = Buffer.from(`${email}:${exp}:not-a-real-signature`).toString("base64url");
    expect(verifyDeletionToken(forged)).toBeNull();
  });

  it("rejects a token that swaps in a different email under a stolen signature", () => {
    const token = signDeletionToken("victim@example.com");
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const sig = decoded.split(":")[2];
    const exp = decoded.split(":")[1];
    const forged = Buffer.from(`attacker@example.com:${exp}:${sig}`).toString("base64url");
    expect(verifyDeletionToken(forged)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyDeletionToken("")).toBeNull();
    expect(verifyDeletionToken("not-base64-!!!")).toBeNull();
    expect(verifyDeletionToken(Buffer.from("only:two").toString("base64url"))).toBeNull();
  });
});

describe("maskEmail", () => {
  it("masks the local part", () => {
    expect(maskEmail("anna.kowalska@example.com")).toBe("a***@example.com");
  });
  it("handles malformed input safely", () => {
    expect(maskEmail("nope")).toBe("***");
  });
});
