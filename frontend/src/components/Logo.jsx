import { cn } from './ui'

export function Mark({ className }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-toyota text-white shadow-sm shadow-toyota/25',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M5 8.5h8.2c3.2 0 5.8 2.3 5.8 5.1 0 2.4-1.9 4.5-4.6 5" strokeLinecap="round" />
        <path d="M5 8.5l4.5-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 8.5l4.5 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function Logo({ variant = 'dark', className }) {
  const lightText = variant !== 'ink'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Mark className="h-10 w-10" />
      <div className="leading-none">
        <span
          className={cn(
            'block text-sm font-extrabold uppercase',
            lightText ? 'text-white' : 'text-slate-950',
          )}
        >
          Nippon Toyota
        </span>
        <span
          className={cn(
            'mt-1 block text-[11px] font-bold uppercase text-toyota',
            lightText ? 'text-toyota-200' : 'text-toyota',
          )}
        >
          Incentive Console
        </span>
      </div>
    </div>
  )
}
