import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api.ts';
import type { PageMeta } from '../lib/types.ts';

interface State<T> {
  data: T | null;
  meta: PageMeta | null;
  loading: boolean;
  error: string | null;
}

export interface ApiResult<T> extends State<T> {
  reload: () => void;
}

/**
 * Data fetching for six screens with no shared cross-screen cache to keep in
 * sync. A cache library would be larger than the app it serves; if this grew
 * optimistic updates or offline writes, that calculus would change.
 *
 * `fetcher` must be referentially stable -- wrap it in useCallback at the call
 * site, keyed on whatever the request actually depends on.
 */
export function useApi<T>(fetcher: () => Promise<{ data: T; meta?: PageMeta }>): ApiResult<T> {
  const [state, setState] = useState<State<T>>({ data: null, meta: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // Filters can change faster than the network responds; `active` makes sure
    // a slow earlier request cannot overwrite a newer one's results.
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetcher()
      .then((result) => {
        if (active) setState({ data: result.data, meta: result.meta ?? null, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof ApiError ? error.message : 'Something went wrong';
        setState({ data: null, meta: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [fetcher, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
