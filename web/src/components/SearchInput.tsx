interface Props {
  value: string;
  onChange: (value: string) => void;
  /** True while the typed value has not yet been pushed to the URL. */
  pending?: boolean;
}

/**
 * `type="search"` gives phone keyboards a "Search" key instead of "Go", and
 * lets the OS render its own clear affordance. The explicit clear button stays
 * because Android does not draw one.
 */
export function SearchInput({ value, onChange, pending = false }: Props) {
  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
      </svg>

      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        aria-label="Search inspections"
        placeholder="Search machine, remarks, defect..."
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pr-10 pl-9 text-body text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 [&::-webkit-search-cancel-button]:hidden"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          {pending ? (
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="size-4" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
