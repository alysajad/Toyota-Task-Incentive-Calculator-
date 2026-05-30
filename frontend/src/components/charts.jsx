import { cn } from './ui'
import { formatNumber } from '../lib/format'

const COLORS = ['#eb0a1e', '#1e293b', '#2563eb', '#f59e0b', '#10b981', '#64748b']

function numeric(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

export function LineAreaChart({
  data,
  valueKey = 'cars',
  labelKey = 'label',
  formatValue = formatNumber,
  color = '#eb0a1e',
  className,
}) {
  if (!data?.length) {
    return <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">No chart data yet.</p>
  }

  const values = data.map((item) => numeric(item[valueKey]))
  const max = Math.max(...values, 1)
  const width = 360
  const height = 170
  const padding = 22
  const usableW = width - padding * 2
  const usableH = height - padding * 2

  const points = values.map((value, index) => {
    const x = padding + (data.length === 1 ? usableW / 2 : (index / (data.length - 1)) * usableW)
    const y = padding + usableH - (value / max) * usableH
    return { x, y, value, label: data[index][labelKey] }
  })

  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`

  return (
    <div className={cn('space-y-3', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible" role="img">
        <title>Trend chart</title>
        {[0, 0.5, 1].map((tick) => {
          const y = padding + usableH * tick
          return (
            <g key={tick}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />
            </g>
          )
        })}
        <polygon points={area} fill={color} opacity="0.12" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke={color} strokeWidth="3" />
            <text x={point.x} y={height - 4} textAnchor="middle" className="fill-slate-500 text-[10px] font-bold">
              {String(point.label).split(' ')[0]}
            </text>
          </g>
        ))}
      </svg>
      <div className="grid gap-2 sm:grid-cols-3">
        {points.slice(-3).map((point) => (
          <div key={point.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="truncate text-xs font-semibold text-slate-500">{point.label}</div>
            <div className="mt-1 font-mono text-sm font-bold text-slate-950 nums">{formatValue(point.value)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DonutChart({
  data,
  valueKey = 'count',
  labelKey = 'label',
  centerLabel = 'Total',
  formatValue = formatNumber,
  className,
}) {
  const total = (data || []).reduce((sum, item) => sum + numeric(item[valueKey]), 0)

  if (!data?.length || total === 0) {
    return <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">No chart data yet.</p>
  }

  const segments = data.reduce((acc, item, index) => {
    const value = numeric(item[valueKey])
    const end = acc.offset + (value / total) * 100
    const color = item.color || COLORS[index % COLORS.length]
    return {
      offset: end,
      values: [...acc.values, `${color} ${acc.offset}% ${end}%`],
    }
  }, { offset: 0, values: [] }).values

  return (
    <div className={cn('grid items-center gap-5 sm:grid-cols-[150px_1fr]', className)}>
      <div className="relative mx-auto h-36 w-36 rounded-full" style={{ background: `conic-gradient(${segments.join(', ')})` }}>
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center">
          <div className="font-mono text-xl font-extrabold text-slate-950 nums">{formatValue(total)}</div>
          <div className="text-[11px] font-bold uppercase text-slate-500">{centerLabel}</div>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((item, index) => {
          const value = numeric(item[valueKey])
          const pct = Math.round((value / total) * 100)
          return (
            <div key={`${item[labelKey]}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                />
                <span className="truncate font-semibold text-slate-700">{item[labelKey]}</span>
              </span>
              <span className="shrink-0 font-mono font-bold text-slate-950 nums">
                {formatValue(value)} · {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HorizontalBarChart({
  data,
  valueKey = 'cars',
  labelKey = 'label',
  detail,
  empty = 'No chart data yet.',
  formatValue = formatNumber,
  className,
}) {
  const max = Math.max(...(data || []).map((item) => numeric(item[valueKey])), 1)

  if (!data?.length) {
    return <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">{empty}</p>
  }

  return (
    <div className={cn('space-y-3', className)}>
      {data.map((item, index) => {
        const value = numeric(item[valueKey])
        const width = Math.max(5, (value / max) * 100)
        return (
          <div key={`${item[labelKey]}-${index}`}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold text-slate-800">{item[labelKey]}</span>
              <span className="shrink-0 font-mono font-bold text-slate-950 nums">{formatValue(value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, backgroundColor: COLORS[index % COLORS.length] }}
              />
            </div>
            {detail && <div className="mt-1 text-xs text-slate-500">{detail(item)}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function StackedBarChart({
  data,
  valueKey = 'count',
  labelKey = 'label',
  formatValue = formatNumber,
}) {
  const total = (data || []).reduce((sum, item) => sum + numeric(item[valueKey]), 0)

  if (!data?.length || total === 0) {
    return <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">No chart data yet.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {data.map((item, index) => {
          const value = numeric(item[valueKey])
          return (
            <div
              key={`${item[labelKey]}-${index}`}
              style={{
                width: `${(value / total) * 100}%`,
                backgroundColor: item.color || COLORS[index % COLORS.length],
              }}
              title={`${item[labelKey]}: ${formatValue(value)}`}
            />
          )
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {data.map((item, index) => (
          <div key={`${item[labelKey]}-legend-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
              />
              {item[labelKey]}
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-slate-950 nums">{formatValue(item[valueKey])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
