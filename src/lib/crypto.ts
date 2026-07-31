// Encrypts secrets (currently: per-club Playtomic API credentials) at rest.
// AES-256-GCM via Node's built-in `crypto` — no external dependency. Each
// call uses a fresh random IV, so encrypting the same plaintext twice
// produces different ciphertext; the auth tag detects any tampering with
// the stored value.
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY is not set. Add it to .env.local (generate with `openssl rand -hex 32`)."
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with `openssl rand -hex 32`."
    );
  }
  return Buffer.from(hex, "hex");
}

/** Encrypts `plaintext`, returning `iv:authTag:ciphertext` (each base64). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

/** Reverses `encrypt()`. Throws if the payload is malformed or tampered with. */
export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted payload.");
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** HMAC-SHA256 signature of `payload` (base64url), keyed by the same secret. */
export function hmac(payload: string): string {
  return createHmac("sha256", getKey()).update(payload).digest("base64url");
}

/** Constant-time check that `sig` is a valid `hmac(payload)`. */
export function verifyHmac(payload: string, sig: string): boolean {
  const expected = Buffer.from(hmac(payload));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
