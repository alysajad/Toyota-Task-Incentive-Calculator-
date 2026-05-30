import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

export const cn = (...classes) => classes.filter(Boolean).join(' ')

const buttonVariants = {
  primary:
    'border border-toyota-700 bg-toyota text-white shadow-sm shadow-toyota/20 ' +
    'hover:bg-toyota-600 focus-visible:ring-toyota/35',
  secondary:
    'border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 ' +
    'hover:bg-slate-50 focus-visible:ring-slate-300',
  outline:
    'border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-toyota/40 ' +
    'hover:bg-toyota-50 hover:text-toyota-800 focus-visible:ring-toyota/25',
  ghost:
    'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 ' +
    'focus-visible:ring-slate-300',
  danger:
    'border border-red-700 bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 ' +
    'focus-visible:ring-red-300',
}

const buttonSizes = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'group/btn inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
        'tracking-normal transition-all duration-200 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50',
        'active:translate-y-px',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
})

const inputTones = {
  dark:
    'border-slate-700 bg-slate-950/70 text-white placeholder:text-slate-500 ' +
    'focus:border-toyota/70 focus:ring-toyota/25',
  light:
    'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 ' +
    'focus:border-toyota/60 focus:ring-toyota/20',
}

export const Input = forwardRef(function Input(
  { className, tone = 'light', invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-lg border px-3.5 text-[15px] font-medium outline-none',
        'transition-colors duration-200 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100',
        inputTones[tone],
        invalid && 'border-red-400 focus:border-red-500 focus:ring-red-100',
        className,
      )}
      aria-invalid={invalid ? 'true' : undefined}
      {...props}
    />
  )
})

export const Select = forwardRef(function Select(
  { className, tone = 'light', invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-11 rounded-lg border px-3 pr-9 text-[15px] font-semibold outline-none',
        'transition-colors duration-200 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100',
        inputTones[tone],
        invalid && 'border-red-400 focus:border-red-500 focus:ring-red-100',
        className,
      )}
      aria-invalid={invalid ? 'true' : undefined}
      {...props}
    >
      {children}
    </select>
  )
})

const labelTones = {
  dark: 'text-slate-300',
  light: 'text-slate-700',
}

export const Field = forwardRef(function Field(
  { label, hint, error, tone = 'light', required, children },
  ref,
) {
  return (
    <label ref={ref} className="block">
      {label && (
        <span
          className={cn(
            'mb-1.5 block text-xs font-bold uppercase tracking-[0.12em]',
            labelTones[tone],
          )}
        >
          {label}
          {required && <span className="ml-1 text-toyota">*</span>}
        </span>
      )}
      {children}
      {hint && !error && (
        <span className={cn('mt-1.5 block text-xs', tone === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
          {hint}
        </span>
      )}
      {error && <span className="mt-1.5 block text-xs font-semibold text-red-600">{error}</span>}
    </label>
  )
})

export const Card = forwardRef(function Card({ className, children, ...props }, ref) {
  const hasCustomBg = /\bbg-/.test(className || '')

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-slate-200 shadow-sm shadow-slate-200/60',
        !hasCustomBg && 'bg-white',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
})

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/80', className)} />
}

export function Spinner({ className }) {
  return <Loader2 className={cn('animate-spin text-toyota', className)} aria-hidden="true" />
}

const badgeTones = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
}

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-5',
        badgeTones[tone] || badgeTones.neutral,
        className,
      )}
    >
      {children}
    </span>
  )
}

const statusTone = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
}

export function StatusBadge({ status }) {
  const label = (status || 'UNKNOWN').replace('_', ' ').toLowerCase()
  return (
    <Badge tone={statusTone[status] || 'neutral'} className="capitalize">
      {label}
    </Badge>
  )
}

export const IconButton = forwardRef(function IconButton(
  { className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500',
        'transition-colors duration-200 cursor-pointer hover:bg-slate-100 hover:text-slate-950',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-toyota/20',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300',
        'bg-slate-50 px-6 py-10 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
