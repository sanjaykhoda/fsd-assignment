import type { DefectType, FieldError, Inspection, PageMeta, Summary } from './types.ts';

const TOKEN_KEY = 'qit.token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Pulls the message for one form field out of the server's details[]. */
  fieldError(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}

export const auth = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

interface Envelope<T> {
  data: T;
  meta?: PageMeta;
}

/**
 * The single fetch path for the whole app. Because every endpoint answers with
 * the same `{ data }` / `{ error }` envelope, unwrapping and error mapping live
 * here once and no caller ever inspects a status code by hand.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const token = auth.token;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  if (response.status === 204) return { data: undefined as T };

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // A 401 anywhere means the session is gone; drop the dead token so the
    // route guard sends the user to the login screen on the next render.
    if (response.status === 401) auth.clear();

    const error = body?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Something went wrong',
      error?.details ?? [],
    );
  }

  return body as Envelope<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: { username: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }).then((res) => res.data),

  listInspections: (query: string) => request<Inspection[]>(`/inspections${query ? `?${query}` : ''}`),

  getInspection: (id: string | number) => request<Inspection>(`/inspections/${id}`).then((res) => res.data),

  createInspection: (input: Record<string, unknown>) =>
    request<Inspection>('/inspections', { method: 'POST', body: JSON.stringify(input) }).then((res) => res.data),

  resolveInspection: (id: number, resolutionNote: string) =>
    request<Inspection>(`/inspections/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolutionNote }),
    }).then((res) => res.data),

  getSummary: (query: string) => request<Summary>(`/inspections/summary${query ? `?${query}` : ''}`),

  listDefectTypes: (includeInactive = false) =>
    request<DefectType[]>(`/defect-types${includeInactive ? '?includeInactive=true' : ''}`),

  createDefectType: (name: string) =>
    request<DefectType>('/defect-types', { method: 'POST', body: JSON.stringify({ name }) }).then((res) => res.data),

  updateDefectType: (id: number, input: { name?: string; isActive?: boolean }) =>
    request<DefectType>(`/defect-types/${id}`, { method: 'PATCH', body: JSON.stringify(input) }).then((res) => res.data),

  deleteDefectType: (id: number) => request<void>(`/defect-types/${id}`, { method: 'DELETE' }),
};
