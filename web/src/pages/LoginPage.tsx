import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button.tsx';
import { controlClass, Field } from '../components/Field.tsx';
import { api, ApiError, auth } from '../lib/api.ts';

/**
 * Prefilled with the demo credentials on purpose. This is a take-home demo, and
 * a reviewer who cannot get past the login screen cannot see anything else --
 * the credentials are also the first thing in the README.
 */
const DEMO = { username: 'supervisor', password: 'inspect123' };

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(DEMO.username);
  const [password, setPassword] = useState(DEMO.password);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.token) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { token } = await api.login(username, password);
      auth.set(token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <svg className="size-6" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-title font-semibold text-slate-900">Quality Inspection Tracker</h1>
            <p className="mt-1 text-meta text-slate-500">Sign in to log and resolve defects</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5">
          <Field label="Username" htmlFor="username">
            <input
              id="username"
              className={controlClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              className={controlClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl border border-critical/20 bg-critical-bg px-3 py-2 text-meta text-critical">
              {error}
            </p>
          )}

          <Button type="submit" full loading={submitting}>
            Sign in
          </Button>

          <p className="text-center text-meta text-slate-400">
            Demo credentials are prefilled: {DEMO.username} / {DEMO.password}
          </p>
        </form>
      </div>
    </div>
  );
}
