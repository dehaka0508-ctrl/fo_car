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
    <section className={cx('px-panel m-[3px] p-4 text-zinc-100', className)}>
      {title || actions ? (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <span aria-hidden="true" className="inline-block size-2 bg-emerald-400 shadow-[2px_2px_0_0_#05080f]" />
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'px-btn bg-emerald-500 text-white hover:bg-emerald-400 disabled:bg-emerald-800 disabled:text-emerald-300/60',
  secondary: 'px-btn bg-zinc-700 text-zinc-50 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500',
  ghost: 'px-focus text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-40',
  danger: 'px-btn bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-900 disabled:text-rose-300/60',
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
        'm-[2px] inline-flex items-center justify-center gap-1 whitespace-nowrap px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed',
        BUTTON_STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span
        className={cx(
          'font-pixel truncate tabular-nums',
          accent ? 'text-2xl text-amber-300 drop-shadow-[2px_2px_0_#05080f]' : 'text-xs text-zinc-50',
        )}
      >
        {value}
      </span>
      {sub ? <span className="truncate text-[11px] text-zinc-400">{sub}</span> : null}
    </div>
  );
}

export function Meter({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const ratio = Math.max(0, Math.min(1, value / max));
  const tone = ratio >= 0.6 ? 'bg-emerald-400' : ratio >= 0.35 ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <div className="flex min-w-24 flex-col gap-1.5">
      <div className="flex justify-between text-[11px] text-zinc-400">
        <span>{label}</span>
        <span className="font-pixel text-xs tabular-nums text-zinc-50">{Math.round(value)}</span>
      </div>
      <div className="px-meter mx-[2px]" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
        <span className={tone} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

type TagTone = 'zinc' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet';

const TAG_STYLES: Record<TagTone, string> = {
  zinc: 'bg-zinc-800 text-zinc-200 shadow-[inset_0_0_0_1px_#34435a]',
  emerald: 'bg-emerald-950 text-emerald-300 shadow-[inset_0_0_0_1px_#1b7a41]',
  amber: 'bg-amber-950 text-amber-300 shadow-[inset_0_0_0_1px_#92400e]',
  sky: 'bg-sky-950 text-sky-300 shadow-[inset_0_0_0_1px_#0369a1]',
  rose: 'bg-rose-950 text-rose-300 shadow-[inset_0_0_0_1px_#be123c]',
  violet: 'bg-violet-950 text-violet-300 shadow-[inset_0_0_0_1px_#6d28d9]',
};

export function Tag({ children, tone = 'zinc' }: { children: ReactNode; tone?: TagTone }) {
  return <span className={cx('font-pixel inline-flex items-center px-1.5 py-0.5 text-[11px] leading-none', TAG_STYLES[tone])}>{children}</span>;
}

export const fieldClass =
  'w-full border-2 border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-50 outline-none focus:border-emerald-400 disabled:opacity-50';

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1 text-xs font-medium text-zinc-400', className)}>
      {label}
      {children}
    </label>
  );
}

export function Modal({ children, onClose, title, wide = false }: { children: ReactNode; onClose?: () => void; title: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#02040a]/75 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className={cx('px-panel m-[3px] max-h-[90vh] w-full overflow-y-auto p-5', wide ? 'max-w-5xl' : 'max-w-lg')}>
        <div className="mb-4 flex items-start justify-between gap-3 border-b-2 border-dashed border-zinc-700 pb-3">
          <h2 className="text-base font-bold text-amber-300 drop-shadow-[2px_2px_0_#05080f]">{title}</h2>
          {onClose ? (
            <button type="button" aria-label="닫기" className="px-focus px-1 text-zinc-400 hover:text-zinc-50" onClick={onClose}>
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
