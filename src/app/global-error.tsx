"use client";

// Last-resort boundary: only fires if the ROOT layout itself throws (so
// LocaleProvider/ClerkProvider never mounted). It must render its own
// <html>/<body> and stays deliberately self-contained — no i18n, no shared
// components — so it can't itself fail the same way. Bilingual by hand
// since there's no locale context to read here.

import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-volt-400 text-2xl"
            aria-hidden="true"
          >
            🎾
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              Something went wrong / Coś poszło nie tak
            </h1>
            <p className="mt-3 max-w-md text-sm text-slate-400">
              Please try again, or come back in a moment.
              <br />
              Spróbuj ponownie albo wróć za chwilę.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => reset()} className="btn btn-primary">
              Try again / Spróbuj ponownie
            </button>
            <a href="/" className="btn btn-secondary">
              Home / Strona główna
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
