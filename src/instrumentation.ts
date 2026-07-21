// Node >= 22 exposes a `localStorage` global on the server whose methods
// throw unless Node was started with --localstorage-file. Isomorphic libraries
// detect the global and call it, crashing server rendering. Remove it so they
// correctly treat the server as storage-less.
export async function register() {
  try {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  } catch {
    // Read-only in some runtimes — nothing to do.
  }

  // Warn (don't crash — CI/preview builds intentionally use placeholder
  // values and never hit these code paths) when required runtime config is
  // missing, so a misconfigured deploy fails loud in logs instead of with a
  // confusing downstream error the first time a real request needs it.
  const required = [
    "MONGODB_URI",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "SUPERADMIN_EMAIL",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(
      `[urPadel] Missing environment variable(s): ${missing.join(", ")}. ` +
        `See .env.example for what's required.`
    );
  }
}
