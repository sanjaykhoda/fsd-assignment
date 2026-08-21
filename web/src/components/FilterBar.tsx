import { STATUSES } from '../lib/constants.ts';
import { formatDate } from '../lib/format.ts';
import type { DefectType } from '../lib/types.ts';
import { SearchInput } from './SearchInput.tsx';

export interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface Props {
  status: string;
  onStatusChange: (status: string) => void;
  activeCount: number;
  chips: ActiveChip[];
  onOpenFilters: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPending: boolean;
}

const SEGMENTS = ['', ...STATUSES];

/**
 * Status is the filter a supervisor reaches for constantly ("what's still
 * open?"), so it is always visible as a segmented control -- zero taps to see,
 * one to apply. Everything rarer lives behind the Filters button.
 */
export function FilterBar({
  status,
  onStatusChange,
  activeCount,
  chips,
  onOpenFilters,
  search,
  onSearchChange,
  searchPending,
}: Props) {
  return (
    <div className="border-b border-slate-200 px-4 py-2">
      {/* Search sits above the status control: it is the widest net, and on a
          phone it is what someone reaches for when they half-remember a job. */}
      <div className="mb-2">
        <SearchInput value={search} onChange={onSearchChange} pending={searchPending} />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-xl border border-slate-300 bg-white p-0.5">
          {SEGMENTS.map((segment) => (
            <button
              key={segment || 'all'}
              onClick={() => onStatusChange(segment)}
              aria-pressed={status === segment}
              className={[
                'min-h-11 flex-1 rounded-[0.625rem] text-meta font-semibold transition-colors',
                status === segment ? 'bg-brand-600 text-white' : 'text-slate-600',
              ].join(' ')}
            >
              {segment || 'All'}
            </button>
          ))}
        </div>

        <button
          onClick={onOpenFilters}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-meta font-semibold text-slate-700"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[0.6875rem] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Applied filters are always visible and always removable -- the user is
          never left in a filtered state they cannot see or escape. */}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onRemove}
              className="flex min-h-8 items-center gap-1 rounded-lg border border-brand-600/20 bg-brand-50 px-2 text-meta font-medium text-brand-700"
            >
              {chip.label}
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Builds the human-readable chip labels from the current URL params. */
export function buildChips(
  params: URLSearchParams,
  defectTypes: DefectType[],
  remove: (key: string, value?: string) => void,
): ActiveChip[] {
  const chips: ActiveChip[] = [];

  for (const severity of params.get('severity')?.split(',').filter(Boolean) ?? []) {
    chips.push({ key: `sev-${severity}`, label: severity, onRemove: () => remove('severity', severity) });
  }

  for (const id of params.get('defectTypeId')?.split(',').filter(Boolean) ?? []) {
    const name = defectTypes.find((type) => String(type.id) === id)?.name ?? 'Defect type';
    chips.push({ key: `dt-${id}`, label: name, onRemove: () => remove('defectTypeId', id) });
  }

  const from = params.get('from');
  const to = params.get('to');
  if (from || to) {
    const label = from && to ? `${formatDate(from)} - ${formatDate(to)}` : from ? `From ${formatDate(from)}` : `Until ${formatDate(to!)}`;
    chips.push({
      key: 'dates',
      label,
      onRemove: () => {
        remove('from');
        remove('to');
      },
    });
  }

  return chips;
}
