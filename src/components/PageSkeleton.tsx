// Generic pulsing skeleton shown by loading.tsx while a page's server data
// is still loading. Server-safe (no hooks) — purely decorative markup.

export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      <div className="space-y-3">
        <div className="h-8 w-64 max-w-full rounded-lg bg-white/10" />
        <div className="h-4 w-96 max-w-full rounded bg-white/5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="card card-pad h-32" />
        ))}
      </div>
    </div>
  );
}
