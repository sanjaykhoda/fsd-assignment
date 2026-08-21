import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell.tsx';
import { Button } from '../components/Button.tsx';
import { buildChips, FilterBar } from '../components/FilterBar.tsx';
import { FilterSheet, type FilterValues } from '../components/FilterSheet.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { InspectionCard } from '../components/InspectionCard.tsx';
import { ErrorState, ListSkeleton } from '../components/Skeleton.tsx';
import { useApi } from '../hooks/useApi.ts';
import { api } from '../lib/api.ts';
import type { DefectType, Inspection, Severity } from '../lib/types.ts';

const PAGE_SIZE = 20;

/** Filters that count towards the "Filters" badge -- status has its own control. */
const SHEET_PARAMS = ['severity', 'defectTypeId', 'from', 'to'] as const;

export function ListPage() {
  const [params, setParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  /*
   * Filter state lives in the URL, not in component state: the view is
   * shareable, survives a refresh, and the Android back button undoes a filter.
   * It also maps 1:1 onto the API's query params, so there is no syncing code.
   */
  const filterKey = new URLSearchParams(params).toString();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Inspection[]>([]);

  // Changing any filter starts a new result set. Adjusting during render (the
  // documented React pattern) avoids firing a throwaway fetch for the old page.
  const lastKey = useRef(filterKey);
  if (lastKey.current !== filterKey) {
    lastKey.current = filterKey;
    setPage(1);
    setItems([]);
  }

  const fetchInspections = useCallback(
    () => api.listInspections(`${filterKey}&page=${page}&pageSize=${PAGE_SIZE}`),
    [filterKey, page],
  );
  const { data, meta, loading, error, reload } = useApi<Inspection[]>(fetchInspections);

  const fetchDefectTypes = useCallback(() => api.listDefectTypes(true), []);
  const { data: defectTypes } = useApi<DefectType[]>(fetchDefectTypes);

  useEffect(() => {
    if (data) setItems((previous) => (page === 1 ? data : [...previous, ...data]));
  }, [data, page]);

  function update(mutate: (next: URLSearchParams) => void) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        mutate(next);
        return next;
      },
      { replace: true },
    );
  }

  /** Removes one value from a comma-separated param, or the param entirely. */
  function remove(key: string, value?: string) {
    update((next) => {
      if (value === undefined) return next.delete(key);
      const remaining = (next.get(key)?.split(',') ?? []).filter((v) => v !== value);
      if (remaining.length) next.set(key, remaining.join(','));
      else next.delete(key);
    });
  }

  function applyFilters(values: FilterValues) {
    update((next) => {
      const set = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
      set('severity', values.severity.join(','));
      set('defectTypeId', values.defectTypeId.join(','));
      set('from', values.from);
      set('to', values.to);
      // The default sort is implicit -- keep it out of the URL.
      set('sort', values.sort === 'inspectedOn' && values.order === 'desc' ? '' : values.sort);
      set('order', values.sort === 'inspectedOn' && values.order === 'desc' ? '' : values.order);
    });
    setSheetOpen(false);
  }

  const activeCount = SHEET_PARAMS.filter((key) => params.get(key)).length;
  const chips = buildChips(params, defectTypes ?? [], remove);
  const hasMore = meta ? items.length < meta.total : false;
  const isFiltered = activeCount > 0 || Boolean(params.get('status'));

  return (
    <AppShell
      title="Inspections"
      subheader={
        <FilterBar
          status={params.get('status') ?? ''}
          onStatusChange={(status) => update((next) => (status ? next.set('status', status) : next.delete('status')))}
          activeCount={activeCount}
          chips={chips}
          onOpenFilters={() => setSheetOpen(true)}
        />
      }
    >
      {meta && items.length > 0 && (
        <p className="mb-3 text-meta text-slate-500">
          {meta.total} inspection{meta.total === 1 ? '' : 's'}
          {isFiltered && ' matching filters'}
        </p>
      )}

      {loading && items.length === 0 && <ListSkeleton />}

      {error && items.length === 0 && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title={isFiltered ? 'No matching inspections' : 'No inspections yet'}
          description={
            isFiltered
              ? 'Nothing matches the current filters. Try widening them.'
              : 'Log the first defect and it will appear here.'
          }
          action={
            isFiltered ? (
              <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            ) : (
              <Link to="/new">
                <Button>Log an inspection</Button>
              </Link>
            )
          }
        />
      )}

      {items.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {items.map((inspection) => (
              <InspectionCard key={inspection.id} inspection={inspection} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-4">
              <Button variant="secondary" full loading={loading} onClick={() => setPage((p) => p + 1)}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <FilterSheet
        open={sheetOpen}
        defectTypes={defectTypes?.filter((type) => type.isActive) ?? []}
        value={{
          severity: (params.get('severity')?.split(',').filter(Boolean) ?? []) as Severity[],
          defectTypeId: (params.get('defectTypeId')?.split(',').filter(Boolean) ?? []).map(Number),
          from: params.get('from') ?? '',
          to: params.get('to') ?? '',
          sort: params.get('sort') ?? 'inspectedOn',
          order: params.get('order') ?? 'desc',
        }}
        onClose={() => setSheetOpen(false)}
        onApply={applyFilters}
      />
    </AppShell>
  );
}
