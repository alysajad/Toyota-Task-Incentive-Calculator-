import { TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import { cn } from './ui'

/** Compact month-over-month payout movement chip, shared by both dashboards. */
export function TrendChip({ direction, pct, delta, prevLabel, className }) {
  if (!prevLabel || direction === 'flat' || pct == null) return null
  const up = direction === 'up'
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-5',
        up ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700',
        className,
      )}
      title={`${formatCurrency(delta)} vs ${prevLabel}`}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {pct}% vs {prevLabel}
    </span>
  )
}
