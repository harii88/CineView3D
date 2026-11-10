'use client';
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useId, useState } from 'react';
import type { Range } from '@/lib/config/validation';
import { validateNumber } from '@/lib/config/validation';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

const ICONS: Record<string, ReactNode> = {
  seat: <path d="M6 11V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M4 11h16v4H4zM6 15v4M18 15v4" />,
  compare: <path d="M8 3v18M16 3v18M3 8h5M16 16h5" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  sliders: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" />,
  share: <path d="M15 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m18 15-6-6-6 6" />,
  reset: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />,
  eye: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  orbit: <path d="M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M21 3l-4 4M17 3h4v4" />,
  walk: <path d="M13 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 22l2-7 3 3v4M7 12l3-4 4 1 2 4M10 8l-1 5" />,
  search: <path d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  map: <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  info: <path d="M12 16v-4M12 8h0M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />,
  play: <path d="m7 4 13 8-13 8z" />,
  pause: <path d="M7 4h4v16H7zM14 4h4v16h-4z" />,
  volume: <path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />,
  mute: <path d="M4 9v6h4l5 4V5L8 9zM17 9l4 6M21 9l-4 6" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  save: <path d="M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7" />,
  sparkles: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />,
};

export function Icon({ name, className = 'h-4 w-4' }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name] ?? null}
    </svg>
  );
}

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'glass' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'glass', size = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        focusRing,
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
        variant === 'primary' && 'bg-gold-400 text-ink-950 hover:bg-gold-300',
        variant === 'glass' && 'border border-white/10 bg-white/[0.06] text-white/90 hover:bg-white/[0.12]',
        variant === 'ghost' && 'text-white/70 hover:bg-white/[0.08] hover:text-white',
        variant === 'danger' && 'text-rose-300 hover:bg-rose-500/15',
        className,
      )}
    />
  );
}

export function GlassPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-2xl border border-white/10 bg-ink-900/70 shadow-glass backdrop-blur-xl', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{children}</h3>
      {action}
    </div>
  );
}

/**
 * Number input that keeps the raw text while typing and validates on commit
 * (Enter / blur), showing an inline error instead of applying bad values.
 */
export function NumberField({
  value,
  range,
  integer,
  onCommit,
  suffix,
  compact,
  externalError,
}: {
  value: number;
  range: Range;
  integer?: boolean;
  onCommit: (v: number) => string | null | void;
  suffix?: string;
  compact?: boolean;
  externalError?: string | null;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setText(String(Math.round(value * 1000) / 1000));
  }, [value]);

  const commit = () => {
    const r = validateNumber(text, range, integer);
    if (!r.ok) {
      setError(r.error!);
      return;
    }
    const err = onCommit(r.value);
    setError(err || null);
    if (err) setText(String(value));
  };
  const step = (dir: number) => {
    const s = range.step ?? 1;
    const next = Math.min(range.max, Math.max(range.min, Math.round((value + dir * s) / s) * s));
    const err = onCommit(Number(next.toFixed(4)));
    setError(err || null);
  };
  const shownError = error ?? externalError ?? null;

  return (
    <div className={compact ? '' : 'space-y-1.5'}>
      <label htmlFor={id} className="flex items-center justify-between text-xs text-white/60">
        <span>{range.label}</span>
        <span className="text-white/35">
          {range.min}–{range.max}
          {suffix ?? (range.unit ? ` ${range.unit}` : '')}
        </span>
      </label>
      <div
        className={cx(
          'flex h-9 items-center overflow-hidden rounded-xl border bg-black/30',
          shownError ? 'border-rose-400/70' : 'border-white/10 focus-within:border-gold-400/70',
        )}
      >
        <button
          type="button"
          aria-label={`Decrease ${range.label}`}
          onClick={() => step(-1)}
          className={cx('h-full w-8 shrink-0 text-white/60 hover:bg-white/10 hover:text-white', focusRing)}
        >
          −
        </button>
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setText(String(value));
              setError(null);
            }
          }}
          aria-invalid={!!shownError}
          aria-describedby={shownError ? `${id}-err` : undefined}
          className="h-full w-full min-w-0 bg-transparent text-center text-sm tabular-nums text-white outline-none"
        />
        <button
          type="button"
          aria-label={`Increase ${range.label}`}
          onClick={() => step(1)}
          className={cx('h-full w-8 shrink-0 text-white/60 hover:bg-white/10 hover:text-white', focusRing)}
        >
          +
        </button>
      </div>
      {shownError && (
        <p id={`${id}-err`} role="alert" className="text-xs text-rose-300">
          {shownError}
        </p>
      )}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex justify-between text-xs text-white/60">
        <span>{label}</span>
        <span className="tabular-nums text-white/80">{format(value)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cv-range w-full"
      />
    </div>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5 stars`} role="img">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <defs>
              <linearGradient id={`sg-${i}-${fill}`}>
                <stop offset={`${fill * 100}%`} stopColor="#efbf5a" />
                <stop offset={`${fill * 100}%`} stopColor="rgba(255,255,255,0.15)" />
              </linearGradient>
            </defs>
            <path fill={`url(#sg-${i}-${fill})`} d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
          </svg>
        );
      })}
    </span>
  );
}
