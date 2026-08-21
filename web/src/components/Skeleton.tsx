/** Placeholder cards matching the real list item's height, so nothing jumps. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading inspections">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="h-5 w-16 rounded-lg bg-slate-100" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="h-3.5 w-32 rounded bg-slate-100" />
            <div className="h-5 w-20 rounded-lg bg-slate-100" />
          </div>
          <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-critical/20 bg-critical-bg p-4 text-center">
      <p className="text-body font-semibold text-critical">Could not load</p>
      <p className="mt-1 text-meta text-slate-600">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 min-h-11 rounded-xl border border-critical/30 bg-white px-4 text-body font-semibold text-critical"
      >
        Try again
      </button>
    </div>
  );
}
