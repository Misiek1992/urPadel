import Link from "next/link";
import { PadelMark } from "@/components/Logo";

// A custom not-found page forces Next.js to render this route dynamically
// (per-request) instead of trying to prerender the built-in /_not-found
// route at build time — which would run outside any request context and
// crash if ClerkProvider (in the root layout) can't find its publishable
// key at that exact moment.
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <PadelMark size={56} />
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-volt-300">
          404
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
          This court is empty
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-400">
          We couldn't find the page you're looking for. It may have moved, or
          the tournament might have already finished.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link href="/clubs" className="btn btn-secondary">
          Browse clubs
        </Link>
      </div>
    </div>
  );
}
