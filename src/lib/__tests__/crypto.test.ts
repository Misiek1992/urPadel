import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../crypto";

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("encrypt/decrypt", () => {
  it("round-trips a string", () => {
    const secret = "sk_live_playtomic_super_secret";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const secret = "same-secret";
    expect(encrypt(secret)).not.toBe(encrypt(secret));
  });

  it("throws if the ciphertext has been tampered with", () => {
    const payload = encrypt("tamper-me");
    const [iv, authTag, ciphertext] = payload.split(":");
    const bytes = Buffer.from(ciphertext, "base64");
    bytes[0] ^= 0xff;
    const tampered = [iv, authTag, bytes.toString("base64")].join(":");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws a clear error when the key env var is missing", () => {
    const saved = process.env.CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
    process.env.CREDENTIALS_ENCRYPTION_KEY = saved;
  });

  it("throws a clear error when the key is the wrong length", () => {
    const saved = process.env.CREDENTIALS_ENCRYPTION_KEY;
    process.env.CREDENTIALS_ENCRYPTION_KEY = "tooshort";
    expect(() => encrypt("x")).toThrow(/64-character hex/);
    process.env.CREDENTIALS_ENCRYPTION_KEY = saved;
  });
});
