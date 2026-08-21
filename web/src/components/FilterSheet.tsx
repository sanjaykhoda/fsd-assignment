import { useEffect, useState } from 'react';
import { SEVERITIES } from '../lib/constants.ts';
import { shiftIso, startOfMonthIso, todayIso } from '../lib/format.ts';
import type { DefectType, Severity } from '../lib/types.ts';
import { Button } from './Button.tsx';
import { controlClass, Field } from './Field.tsx';
import { Sheet } from './Sheet.tsx';

export interface FilterValues {
  severity: Severity[];
  defectTypeId: number[];
  from: string;
  to: string;
  sort: string;
  order: string;
}

interface Props {
  open: boolean;
  value: FilterValues;
  defectTypes: DefectType[];
  onClose: () => void;
  onApply: (value: FilterValues) => void;
}

/** Typing two dates on a phone is tedious; these cover the common intents. */
const DATE_PRESETS = [
  { label: 'Last 7 days', range: () => ({ from: shiftIso(todayIso(), -6), to: todayIso() }) },
  { label: 'Last 30 days', range: () => ({ from: shiftIso(todayIso(), -29), to: todayIso() }) },
  { label: 'This month', range: () => ({ from: startOfMonthIso(), to: todayIso() }) },
];

const SORTS = [
  { value: 'inspectedOn:desc', label: 'Newest first' },
  { value: 'inspectedOn:asc', label: 'Oldest first' },
  { value: 'severity:desc', label: 'Most severe first' },
  { value: 'severity:asc', label: 'Least severe first' },
  { value: 'machineId:asc', label: 'Machine / line (A-Z)' },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'min-h-11 rounded-xl border px-3 text-body font-medium transition-colors',
        active
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * Everything except status lives here. Edits are held locally and only pushed
 * to the URL on Apply, so a half-built filter never triggers a fetch.
 */
export function FilterSheet({ open, value, defectTypes, onClose, onApply }: Props) {
  const [draft, setDraft] = useState(value);

  // Re-sync whenever the sheet reopens, in case the URL changed behind it.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const toggle = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((v) => v !== item) : [...list, item];

  const clearAll = () =>
    setDraft({ severity: [], defectTypeId: [], from: '', to: '', sort: 'inspectedOn', order: 'desc' });

  return (
    <Sheet
      open={open}
      title="Filter & sort"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={clearAll} className="flex-1">
            Clear all
          </Button>
          <Button onClick={() => onApply(draft)} className="flex-1">
            Apply
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Severity">
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((severity) => (
              <Chip
                key={severity}
                active={draft.severity.includes(severity)}
                onClick={() => setDraft({ ...draft, severity: toggle(draft.severity, severity) })}
              >
                {severity}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Defect type">
          <div className="flex flex-wrap gap-2">
            {defectTypes.map((type) => (
              <Chip
                key={type.id}
                active={draft.defectTypeId.includes(type.id)}
                onClick={() => setDraft({ ...draft, defectTypeId: toggle(draft.defectTypeId, type.id) })}
              >
                {type.name}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Date range">
          <div className="mb-2 flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => {
              const range = preset.range();
              return (
                <Chip
                  key={preset.label}
                  active={draft.from === range.from && draft.to === range.to}
                  onClick={() => setDraft({ ...draft, ...range })}
                >
                  {preset.label}
                </Chip>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="From date"
              max={draft.to || todayIso()}
              className={controlClass}
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
            <span className="text-meta text-slate-400">to</span>
            <input
              type="date"
              aria-label="To date"
              min={draft.from || undefined}
              max={todayIso()}
              className={controlClass}
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </div>
        </Field>

        <Field label="Sort by" htmlFor="sort">
          <select
            id="sort"
            className={controlClass}
            value={`${draft.sort}:${draft.order}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split(':') as [string, string];
              setDraft({ ...draft, sort, order });
            }}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Sheet>
  );
}
