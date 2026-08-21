import { useCallback, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell.tsx';
import { Button } from '../components/Button.tsx';
import { controlClass, Field } from '../components/Field.tsx';
import { ErrorState } from '../components/Skeleton.tsx';
import { useToast } from '../components/Toast.tsx';
import { useApi } from '../hooks/useApi.ts';
import { api, ApiError } from '../lib/api.ts';
import type { DefectType } from '../lib/types.ts';

/**
 * Defect categories differ by plant and change over time, so they are data
 * rather than a hardcoded list. Built-in types (the five in the original spec)
 * are locked; custom ones can be retired, and deleted outright only while
 * nothing references them -- deleting a type in use would rewrite history.
 */
export function DefectTypesPage() {
  const toast = useToast();
  const fetchTypes = useCallback(() => api.listDefectTypes(true), []);
  const { data, loading, error, reload } = useApi<DefectType[]>(fetchTypes);

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function addType(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const created = await api.createDefectType(name.trim());
      setName('');
      toast(`Added "${created.name}"`);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? (err.fieldError('name') ?? err.message) : 'Could not add defect type');
    } finally {
      setSubmitting(false);
    }
  }

  async function run(id: number, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    try {
      await action();
      toast(success);
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Defect types" back="/" action={<span />}>
      <form onSubmit={addType} className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
        <Field label="Add a defect type" htmlFor="name" error={formError ?? undefined} hint="e.g. Slub / Neps, Edge Damage">
          <div className="flex gap-2">
            <input
              id="name"
              required
              maxLength={60}
              placeholder="New defect type"
              className={controlClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" loading={submitting} disabled={!name.trim()}>
              Add
            </Button>
          </div>
        </Field>
      </form>

      {loading && !data && <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />}
      {error && !data && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <ul className="flex flex-col gap-3">
          {data.map((type) => (
            <li
              key={type.id}
              className={[
                'rounded-xl border border-slate-200 bg-white p-4',
                type.isActive ? '' : 'opacity-70',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-slate-900">{type.name}</p>
                  <p className="mt-0.5 text-meta text-slate-500">
                    {type.code} &middot; used by {type.usageCount} inspection{type.usageCount === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {type.isSystem && (
                    <span className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-0.5 text-meta font-medium text-slate-600">
                      Built-in
                    </span>
                  )}
                  {!type.isActive && (
                    <span className="rounded-lg border border-amber-600/20 bg-amber-50 px-2 py-0.5 text-meta font-medium text-amber-700">
                      Retired
                    </span>
                  )}
                </div>
              </div>

              {!type.isSystem && (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    loading={busyId === type.id}
                    onClick={() =>
                      run(
                        type.id,
                        () => api.updateDefectType(type.id, { isActive: !type.isActive }),
                        type.isActive ? `"${type.name}" retired` : `"${type.name}" reactivated`,
                      )
                    }
                  >
                    {type.isActive ? 'Retire' : 'Reactivate'}
                  </Button>

                  {/* Only offered when nothing references it -- otherwise the
                      API answers 409 and retiring is the correct action. */}
                  {type.usageCount === 0 && (
                    <Button
                      variant="danger"
                      loading={busyId === type.id}
                      onClick={() => run(type.id, () => api.deleteDefectType(type.id), `"${type.name}" deleted`)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-center text-meta text-slate-400">
        Retired types stay on existing inspections but cannot be picked for new ones.
      </p>
    </AppShell>
  );
}
