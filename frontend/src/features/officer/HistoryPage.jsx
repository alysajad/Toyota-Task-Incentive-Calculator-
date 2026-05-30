import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { History, Car, ChevronRight } from 'lucide-react'

import { salesApi, asList } from '../../api/endpoints'
import { parseError } from '../../api/client'
import { Card, Skeleton, EmptyState, Badge } from '../../components/ui'
import { ExportMenu } from '../../components/ExportMenu'
import { MONTHS, formatCurrency } from '../../lib/format'

export default function HistoryPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const data = asList(await salesApi.list())
        if (active) setEntries(data)
      } catch (err) {
        if (active) setError(parseError(err).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return <EmptyState icon={History} title="Couldn't load history" description={error} />
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No submissions yet"
        description="Once you save a month's sales on the calculator, it'll show up here with its payout."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Your saved monthly submissions and their calculated payouts.</p>
        <ExportMenu />
      </div>
      {entries.map((entry, i) => {
        const calc = entry.calculation || {}
        const expanded = open === entry.id
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3) }}
          >
            <Card className="overflow-hidden">
              <button
                onClick={() => setOpen(expanded ? null : entry.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-200 cursor-pointer hover:bg-slate-50"
              >
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-950 text-white">
                  <span className="text-[10px] font-semibold uppercase leading-none text-white/60">
                    {MONTHS[entry.month - 1].slice(0, 3)}
                  </span>
                  <span className="text-sm font-bold leading-none nums">{entry.year}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-950">
                    {MONTHS[entry.month - 1]} {entry.year}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="nums">{calc.total_cars ?? 0} cars</span>
                    {calc.slab && (
                      <Badge tone="neutral">
                        <span className="nums">{calc.slab.label}</span> tier
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-slate-950 nums">
                    {formatCurrency(calc.total_payout || 0)}
                  </div>
                  <div className="text-xs text-slate-500">payout</div>
                </div>
                <ChevronRight
                  className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                />
              </button>

              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="border-t border-slate-200 bg-slate-50 px-5 py-4"
                >
                  {(calc.breakdown || []).filter((b) => b.cars_sold > 0).length === 0 ? (
                    <p className="text-sm text-slate-500">No cars logged for this month.</p>
                  ) : (
                    <div className="space-y-2">
                      {calc.breakdown
                        .filter((b) => b.cars_sold > 0)
                        .map((b) => (
                          <div key={b.car_model} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-slate-700">
                              <Car className="h-3.5 w-3.5 text-slate-400" />
                              {b.car_name}
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="text-slate-500 nums">×{b.cars_sold}</span>
                              <span className="font-mono font-semibold text-slate-950 nums">
                                {formatCurrency(b.line_payout)}
                              </span>
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </motion.div>
              )}
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
