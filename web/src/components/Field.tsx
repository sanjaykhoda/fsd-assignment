import type { ReactNode } from 'react';

interface Props {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}

/**
 * One layout for every form row, so labels, hints and error text always sit in
 * the same place. Errors come from the API's details[] and render in the same
 * slot as client-side ones -- the server's validation contract IS the form's.
 */
export function Field({ label, htmlFor, error, hint, optional, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-meta font-semibold text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-meta text-critical">
          {error}
        </p>
      ) : (
        hint && <p className="text-meta text-slate-500">{hint}</p>
      )}
    </div>
  );
}

/** Shared control styling -- 48px tall, 16px text (see index.css on iOS zoom). */
export const controlClass =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20';
