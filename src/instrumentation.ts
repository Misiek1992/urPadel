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
}
