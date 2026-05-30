import { cn } from './ui'

const dealerLogo = '/nippon-toyota-logo.png'
const dealerMark = '/nippon-toyota-mark.png'

export function Mark({ variant = 'red', className }) {
  const light = variant === 'light'

  return (
    <span
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center',
        className,
      )}
      aria-hidden="true"
    >
      <img
        src={dealerMark}
        alt=""
        className={cn('h-full w-full object-contain', light && 'brightness-0 invert')}
      />
    </span>
  )
}

export function Logo({ variant = 'dark', className }) {
  const onDark = variant !== 'ink'

  return (
    <div className={cn('inline-flex flex-col items-start leading-none', className)}>
      <img
        src={dealerLogo}
        alt="Nippon Toyota"
        className={cn('h-[21px] w-auto object-contain', onDark && 'brightness-0 invert')}
      />
      <span
        className={cn(
          'mt-1.5 block text-[11px] font-extrabold uppercase leading-none',
          onDark ? 'text-white' : 'text-toyota',
        )}
      >
        Incentive Console
      </span>
    </div>
  )
}
