/** 게임 화면 공용 UI 조각 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      {title || actions ? (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/40',
  secondary:
    'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
  ghost: 'text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/40',
};

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed',
        BUTTON_STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span
        className={cx(
          'truncate font-semibold tabular-nums',
          accent ? 'text-2xl text-emerald-600 dark:text-emerald-400' : 'text-sm text-zinc-900 dark:text-zinc-100',
        )}
      >
        {value}
      </span>
      {sub ? <span className="truncate text-[11px] text-zinc-500">{sub}</span> : null}
    </div>
  );
}

export function Meter({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const ratio = Math.max(0, Math.min(1, value / max));
  const tone = ratio >= 0.6 ? 'bg-emerald-500' : ratio >= 0.35 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex min-w-24 flex-col gap-1">
      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-800 dark:text-zinc-200">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-700">
        <div className={cx('h-full rounded', tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

type TagTone = 'zinc' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet';

const TAG_STYLES: Record<TagTone, string> = {
  zinc: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
};

export function Tag({ children, tone = 'zinc' }: { children: ReactNode; tone?: TagTone }) {
  return <span className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', TAG_STYLES[tone])}>{children}</span>;
}

export const fieldClass =
  'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100';

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400', className)}>
      {label}
      {children}
    </label>
  );
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-zinc-900">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
          {onClose ? (
            <button type="button" aria-label="닫기" className="text-zinc-400 hover:text-zinc-600" onClick={onClose}>
              ✕
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function signed(value: number, digits = 0): string {
  const fixed = digits ? value.toFixed(digits) : String(Math.round(value));
  return value > 0 ? `+${fixed}` : fixed;
}
