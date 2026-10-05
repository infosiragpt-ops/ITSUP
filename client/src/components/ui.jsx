import { useEffect, useRef, useState, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { initials } from '../lib/format.js';

export const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------------- Button ---------------- */

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_1px_2px_rgb(0_0_0/0.12)]',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  soft: 'bg-primary-soft text-primary-ink hover:bg-primary/15',
  ghost: 'text-ink-2 hover:bg-sunken',
  danger: 'bg-danger text-white hover:opacity-90',
  dark: 'bg-ink text-bg hover:opacity-90',
  white: 'bg-white text-[#141413] hover:bg-white/90',
};
const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading, className, to, href, children, disabled, ...props }, ref
) {
  const cls = cx(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150 active:scale-[.98] disabled:opacity-50 disabled:active:scale-100',
    VARIANTS[variant], SIZES[size], className
  );
  const iconSize = size === 'sm' ? 15 : 17;
  const content = (
    <>
      {loading ? <Loader2 size={iconSize} className="animate-spin" /> : Icon && <Icon size={iconSize} strokeWidth={2} />}
      {children}
      {IconRight && <IconRight size={iconSize} strokeWidth={2} />}
    </>
  );
  if (to) return <Link ref={ref} to={to} className={cls} {...props}>{content}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} {...props}>{content}</a>;
  return <button ref={ref} className={cls} disabled={disabled || loading} {...props}>{content}</button>;
});

export function IconButton({ icon: Icon, label, className, size = 18, ...props }) {
  return (
    <button aria-label={label} title={label} className={cx('inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-sunken hover:text-ink', className)} {...props}>
      <Icon size={size} />
    </button>
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({ as: As = 'div', className, children, ...props }) {
  return <As className={cx('card', className)} {...props}>{children}</As>;
}

const TONES = {
  neutral: 'bg-sunken text-muted border-line',
  primary: 'bg-primary-soft text-primary-ink border-primary/20',
  success: 'bg-success-soft text-success border-success/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-info-soft text-info border-info/20',
};

export function Badge({ tone = 'neutral', icon: Icon, children, className, dot }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {Icon && <Icon size={12} strokeWidth={2.25} />}
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions, className }) {
  return (
    <div className={cx('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-semibold tracking-[0.12em] text-primary uppercase">{eyebrow}</div>}
        <h1 className="font-display text-[1.9rem] leading-tight font-semibold text-ink sm:text-[2.15rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, action, className, icon: Icon }) {
  return (
    <div className={cx('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        {Icon && <Icon size={17} className="text-primary" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

/* ---------------- Form controls ---------------- */

export function Field({ label, hint, error, children, className, required }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">
          {label} {required && <span className="text-primary">*</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx('input', className)} {...p} />;
});
export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...p }, ref) {
  return <textarea ref={ref} rows={rows} className={cx('input resize-y leading-relaxed', className)} {...p} />;
});
export function Select({ className, children, ...p }) {
  return (
    <select className={cx('input appearance-none bg-[length:16px] bg-[right_0.7rem_center] bg-no-repeat pr-9', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239A988F' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm text-ink-2">
      <span className={cx('relative h-5 w-9 rounded-full transition', checked ? 'bg-primary' : 'bg-line-strong')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input:not([type=hidden]):not([type=file]), textarea, select, button[data-autofocus]')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-[#141413]/45 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className={cx('animate-scale-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-lift sm:rounded-2xl', widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="scrollbar-thin overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-sunken/50 px-5 py-3.5 sm:px-6 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ---------------- Feedback ---------------- */

export function Spinner({ className, size = 20 }) {
  return <Loader2 size={size} className={cx('animate-spin text-primary', className)} />;
}

export function PageLoader({ label = 'Cargando…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted">
      <Spinner size={26} />
      {label}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton', className)} />;
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger"><AlertTriangle size={22} /></div>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className, compact }) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon size={24} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Data display ---------------- */

export function Avatar({ user, size = 36, className, ring }) {
  const s = { width: size, height: size, fontSize: Math.max(11, size * 0.38), background: user?.avatar_color || '#C96442' };
  return (
    <span style={s} className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none', ring && 'ring-2 ring-surface', className)} aria-hidden>
      {initials(user)}
    </span>
  );
}

export function ProgressBar({ value = 0, className, tone = 'primary', size = 'md' }) {
  const colors = { primary: 'bg-primary', success: 'bg-success', warn: 'bg-warn', ink: 'bg-ink' };
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-sunken', size === 'sm' ? 'h-1.5' : 'h-2', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-700 ease-out', colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function ProgressRing({ value = 0, size = 56, stroke = 5, color = 'var(--c-primary)', children, track = 'var(--c-sunken)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (Math.min(100, value) / 100) * c} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink">{children ?? `${value}%`}</div>
    </div>
  );
}

export function Stat({ icon: Icon, label, value, hint, tone = 'primary' }) {
  const bg = { primary: 'bg-primary-soft text-primary', success: 'bg-success-soft text-success', info: 'bg-info-soft text-info', warn: 'bg-warn-soft text-warn' };
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', bg[tone])}><Icon size={20} /></div>
      <div className="min-w-0">
        <div className="text-[13px] text-muted">{label}</div>
        <div className="text-xl font-semibold text-ink tabular-nums">{value}</div>
        {hint && <div className="truncate text-xs text-faint">{hint}</div>}
      </div>
    </Card>
  );
}

/* ---------------- Menus ---------------- */

export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    const k = (e) => e.key === 'Escape' && onOutside();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [ref, onOutside, active]);
}

export function Dropdown({ trigger, children, align = 'right', width = 'w-56', className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div ref={ref} className={cx('relative', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={cx('animate-scale-in absolute top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-lift', width, align === 'right' ? 'right-0' : 'left-0')}
          onClick={(e) => e.target.closest('[data-close]') && setOpen(false)}>
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, to, onClick, danger }) {
  const cls = cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition', danger ? 'text-danger hover:bg-danger-soft' : 'text-ink-2 hover:bg-sunken');
  const inner = <>{Icon && <Icon size={16} className={danger ? '' : 'text-muted'} />}{children}</>;
  if (to) return <Link to={to} className={cls} data-close>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls} data-close>{inner}</button>;
}

/* ---------------- Tabs (segmented) ---------------- */

export function Segmented({ value, onChange, options, className }) {
  return (
    <div className={cx('inline-flex rounded-xl border border-line bg-sunken p-1', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition', value === o.value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink')}>
          {o.label}
          {o.count != null && <span className="ml-1.5 text-faint">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
