import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Car,
  CheckCircle2,
  Info,
  Layers,
  Minus,
  PieChart,
  Plus,
  Save,
  TrendingUp,
  Trophy,
  Wallet,
  AlertTriangle,
} from 'lucide-react'

import { analyticsApi, carsApi, slabsApi, salesApi, asList } from '../../api/endpoints'
import { parseError } from '../../api/client'
import { DonutChart, HorizontalBarChart, LineAreaChart } from '../../components/charts'
import { Button, Card, Skeleton, EmptyState, Badge } from '../../components/ui'
import { Select } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { useDebounce } from '../../lib/useDebounce'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { MONTHS, formatCurrency, formatNumber } from '../../lib/format'

const NOW = new Date()
const YEARS = [NOW.getFullYear() - 1, NOW.getFullYear(), NOW.getFullYear() + 1]

function MetricTile({ icon: Icon, label, value, caption, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-toyota-50 text-toyota',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  }

  return (
    <Card className="p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-2xl font-extrabold text-slate-950 nums">{value}</div>
      <div className="mt-1 text-sm font-bold text-slate-800">{label}</div>
      {caption && <div className="mt-1 text-xs leading-5 text-slate-500">{caption}</div>}
    </Card>
  )
}

function AnalyticsPanel({ title, subtitle, icon: Icon, children }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <div>
          <h3 className="font-bold text-slate-950">{title}</h3>
          {subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  )
}

export default function OfficerDashboard() {
  const toast = useToast()
  const [cars, setCars] = useState([])
  const [slabs, setSlabs] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  const [month, setMonth] = useState(NOW.getMonth() + 1)
  const [year, setYear] = useState(NOW.getFullYear())
  const [volumes, setVolumes] = useState({}) // {carId: count}
  const [savedSnapshot, setSavedSnapshot] = useState('{}')

  const [calc, setCalc] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Initial load: active cars + slab ladder.
  useEffect(() => {
    let active = true
    async function init() {
      try {
        const [carData, slabData, analyticsData] = await Promise.all([
          carsApi.list({ active: true }),
          slabsApi.list(),
          analyticsApi.officer(),
        ])
        if (!active) return
        setCars(asList(carData))
        setSlabs(asList(slabData).sort((a, b) => a.min_cars - b.min_cars))
        setAnalytics(analyticsData)
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  // Load an existing entry whenever month/year changes (prefill).
  useEffect(() => {
    let active = true
    async function loadEntry() {
      try {
        const entry = await salesApi.get(month, year)
        if (!active) return
        const map = {}
        entry.lines.forEach((l) => {
          map[l.car_model] = l.cars_sold
        })
        setVolumes(map)
        setSavedSnapshot(JSON.stringify(map))
      } catch (err) {
        if (!active) return
        if (err.response?.status === 404) {
          setVolumes({})
          setSavedSnapshot('{}')
        } else {
          toast.error(parseError(err).message)
        }
      }
    }
    loadEntry()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year])

  // Build calc lines and debounce them.
  const lines = useMemo(
    () =>
      cars
        .map((c) => ({ car_model: c.id, cars_sold: Number(volumes[c.id] || 0) }))
        .filter((l) => l.cars_sold > 0),
    [cars, volumes]
  )
  const debouncedLines = useDebounce(lines, 350)

  useEffect(() => {
    let active = true
    async function run() {
      setCalculating(true)
      try {
        const res = await salesApi.calculate({ lines: debouncedLines, month, year })
        if (active) setCalc(res)
      } catch (err) {
        if (active) toast.error(parseError(err).message)
      } finally {
        if (active) setCalculating(false)
      }
    }
    run()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLines, month, year])

  const totalCars = lines.reduce((s, l) => s + l.cars_sold, 0)
  const dirty = JSON.stringify(volumes) !== savedSnapshot

  const setVolume = (carId, value) => {
    const n = Math.max(0, Math.floor(Number(value) || 0))
    setVolumes((v) => ({ ...v, [carId]: n }))
  }
  const bump = (carId, delta) => setVolume(carId, (Number(volumes[carId]) || 0) + delta)

  const onSave = async () => {
    setSaving(true)
    try {
      await salesApi.save({
        month,
        year,
        lines: cars.map((c) => ({ car_model: c.id, cars_sold: Number(volumes[c.id] || 0) })),
      })
      setSavedSnapshot(JSON.stringify(volumes))
      setAnalytics(await analyticsApi.officer())
      toast.success(`Sales saved for ${MONTHS[month - 1]} ${year}.`)
    } catch (err) {
      toast.error(parseError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const matchedLabel = calc?.slab?.label
  const officerSummary = analytics?.summary || {}
  const officerCurrent = analytics?.current_month || {}
  const officerTrend = analytics?.monthly_trend || []
  const officerModelMix = analytics?.model_mix || []
  const officerSlabs = analytics?.slab_distribution || []

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            icon={Wallet}
            label="Lifetime payout"
            value={formatCurrency(officerSummary.total_payout)}
            caption={`${formatNumber(officerSummary.submissions)} saved month${officerSummary.submissions === 1 ? '' : 's'}`}
            tone="red"
          />
          <MetricTile
            icon={Activity}
            label="Total cars"
            value={formatNumber(officerSummary.total_cars)}
            caption={`${formatNumber(officerSummary.avg_cars_per_submission)} avg cars per month`}
            tone="blue"
          />
          <MetricTile
            icon={Trophy}
            label="Best month"
            value={formatCurrency(officerSummary.best_month_payout)}
            caption={officerSummary.best_month_label || 'No saved month yet'}
            tone="green"
          />
          <MetricTile
            icon={Car}
            label="Current saved"
            value={formatNumber(officerCurrent.cars)}
            caption={`${officerCurrent.label || MONTHS[month - 1]} · ${officerCurrent.slab || 'No tier'}`}
            tone="slate"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr_0.95fr]">
          <AnalyticsPanel
            title="My payout trend"
            subtitle="Saved monthly payouts over time"
            icon={BarChart3}
          >
            <LineAreaChart
              data={officerTrend}
              valueKey="total_payout"
              labelKey="label"
              formatValue={formatCurrency}
            />
          </AnalyticsPanel>

          <AnalyticsPanel title="My model mix" subtitle="Cars sold by model" icon={PieChart}>
            <HorizontalBarChart
              data={officerModelMix}
              valueKey="cars"
              labelKey="model"
              empty="No model sales saved yet."
              detail={(item) =>
                `${item.variant || 'Base variant'} · ${formatNumber(item.submissions)} submission${item.submissions === 1 ? '' : 's'}`
              }
            />
          </AnalyticsPanel>

          <AnalyticsPanel title="My tier history" subtitle="Saved months grouped by slab" icon={Layers}>
            <DonutChart
              data={officerSlabs}
              valueKey="cars"
              labelKey="label"
              centerLabel="Cars"
            />
          </AnalyticsPanel>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Left: inputs */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Log monthly sales</h2>
              <p className="mt-1 text-sm text-slate-500">Enter cars sold per model. The payout updates live.</p>
            </div>
            <div className="flex gap-2">
              <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            </div>
          </div>

          {cars.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No car models available"
              description="An administrator hasn't published any active models yet. Check back soon."
            />
          ) : (
            <div className="space-y-2 p-5">
              {cars.map((car) => {
                const val = Number(volumes[car.id] || 0)
                return (
                  <div
                    key={car.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-200 ${
                      val > 0 ? 'border-toyota/30 bg-toyota-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Car className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-950">{car.model_name}</div>
                      {car.variant && <div className="truncate text-xs text-slate-500">{car.variant}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => bump(car.id, -1)}
                        disabled={val <= 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors duration-200 cursor-pointer hover:border-slate-400 hover:text-slate-950 disabled:pointer-events-none disabled:opacity-40"
                        aria-label="Decrease"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={volumes[car.id] ?? ''}
                        onChange={(e) => setVolume(car.id, e.target.value)}
                        placeholder="0"
                        className="nums h-9 w-14 rounded-lg border border-slate-300 bg-white text-center text-sm font-semibold text-slate-950 focus:border-toyota focus:outline-none focus:ring-4 focus:ring-toyota/10"
                      />
                      <button
                        onClick={() => bump(car.id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors duration-200 cursor-pointer hover:border-toyota hover:text-toyota"
                        aria-label="Increase"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Tier ladder reference */}
        {slabs.length > 0 && (
          <Card className="p-5">
            <h3 className="mb-3 text-xs font-bold uppercase text-slate-500">
              Incentive ladder
            </h3>
            <div className="space-y-1.5">
              {slabs.map((s) => {
                const hit = s.label === matchedLabel
                return (
                  <motion.div
                    key={s.id}
                    animate={{ scale: hit ? 1 : 1 }}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      hit ? 'bg-slate-950 text-white shadow-sm' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold nums">{s.label}</span>
                      <span className={hit ? 'text-white/60' : 'text-slate-500'}>cars</span>
                      {hit && <Badge tone="red">current tier</Badge>}
                    </span>
                    <span className="nums font-mono font-semibold">
                      {formatCurrency(s.rate_per_car)}/car
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Right: real-time payout panel (sticky desktop / sheet mobile) */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card className="overflow-hidden bg-slate-950 text-white shadow-float">
          <div className="dash-grid border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                <Wallet className="h-3.5 w-3.5" />
                Projected payout
              </span>
              <AnimatePresence>
                {calculating && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-slate-500"
                  >
                    updating…
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 text-4xl font-extrabold">
              <span className="text-toyota">₹</span>
              <AnimatedNumber
                value={Number(calc?.total_payout || 0)}
                format={(n) => formatNumber(Math.round(n))}
              />
            </div>

            <div className="mt-3 flex items-center gap-4 text-sm">
              <div>
                <div className="font-display text-xl font-bold nums">{totalCars}</div>
                <div className="text-xs text-slate-500">cars sold</div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                {matchedLabel ? (
                  <>
                    <div className="font-display text-xl font-bold nums">{matchedLabel}</div>
                    <div className="text-[11px] text-white/40">
                      tier · {formatCurrency(calc?.slab?.rate_per_car)}/car
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xl font-bold text-slate-600">—</div>
                    <div className="text-xs text-slate-500">no tier yet</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status / breakdown */}
          <div className="px-5 py-4">
            {totalCars === 0 ? (
              <div className="flex items-start gap-2 text-sm text-slate-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Add some cars to see your projected incentive for the month.
              </div>
            ) : calc && !calc.matched && calc.message ? (
              <div className="flex items-start gap-2 rounded-lg bg-toyota/15 px-3 py-2.5 text-sm text-toyota-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-toyota" />
                <span className="text-white/80">{calc.message}</span>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Per-model breakdown
                </div>
                <div className="space-y-1.5 scroll-thin max-h-48 overflow-y-auto">
                  {(calc?.breakdown || []).map((b) => (
                    <div key={b.car_model} className="flex items-center justify-between text-sm">
                      <span className="truncate text-white/70">{b.car_name}</span>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-white/40 nums">×{b.cars_sold}</span>
                        <span className="font-mono font-semibold nums">
                          {formatCurrency(b.line_payout)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <Button
              className="w-full"
              onClick={onSave}
              loading={saving}
              disabled={!dirty}
            >
              {dirty ? (
                <>
                  <Save className="h-4 w-4" />
                  Save for {MONTHS[month - 1]} {year}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  All changes saved
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
      </div>
    </div>
  )
}
