import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

const ToastContext = createContext<((message: string, tone?: Toast['tone']) => void) | null>(null);

/** Confirms an action that navigated away from where it happened. */
export function useToast() {
  const show = use(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3500);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      {children}
      {/* Above the bottom nav so it never covers the tabs. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={[
              'w-full max-w-sm rounded-xl border px-4 py-3 text-body font-medium shadow-lg motion-safe:animate-[toastIn_180ms_ease-out]',
              toast.tone === 'success'
                ? 'border-emerald-600/20 bg-emerald-50 text-emerald-800'
                : 'border-critical/20 bg-critical-bg text-critical',
            ].join(' ')}
          >
            {toast.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </ToastContext>
  );
}
