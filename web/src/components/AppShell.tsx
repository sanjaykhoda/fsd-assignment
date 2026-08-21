import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../lib/api.ts';

/**
 * Three destinations, so a bottom tab bar rather than a hamburger: every
 * destination is one thumb-reach tap, with no menu to open first. Logging a
 * defect is the supervisor's main job, so it gets a permanent tab and is one
 * tap from anywhere in the app.
 */
const TABS = [
  {
    to: '/',
    label: 'Inspections',
    icon: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  },
  {
    to: '/new',
    label: 'Log',
    icon: 'M12 4.5v15m7.5-7.5h-15',
  },
  {
    to: '/summary',
    label: 'Summary',
    icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  },
] as const;

interface Props {
  title: string;
  children: ReactNode;
  /** Rendered under the header and sticks with it -- the list's filter bar. */
  subheader?: ReactNode;
  action?: ReactNode;
  back?: string;
}

export function AppShell({ title, children, subheader, action, back }: Props) {
  const navigate = useNavigate();

  function signOut() {
    auth.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur">
        <header className="flex h-14 items-center gap-1 border-b border-slate-200 px-4">
          {back && (
            <Link
              to={back}
              aria-label="Back"
              className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}

          <h1 className="flex-1 truncate text-title font-semibold text-slate-900">{title}</h1>

          {action ?? (
            <div className="flex items-center">
              <Link
                to="/defect-types"
                aria-label="Manage defect types"
                className="flex size-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.108 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.893-.15c-.543-.09-.94-.559-.94-1.109v-1.094c0-.55.397-1.02.94-1.11l.893-.149c.425-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.893Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </Link>
              <button
                onClick={signOut}
                aria-label="Sign out"
                className="flex size-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
              </button>
            </div>
          )}
        </header>

        {subheader}
      </div>

      {/* pb-28 keeps the last card clear of the fixed nav. */}
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur">
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold transition-colors',
                    isActive ? 'text-brand-600' : 'text-slate-500',
                  ].join(' ')
                }
              >
                <svg className="size-6" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
