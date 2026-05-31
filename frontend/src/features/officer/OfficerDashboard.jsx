import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Calendar,
  Car,
  CheckCircle2,
  Flame,
  Info,
  Layers,
  Minus,
  PieChart,
  Plus,
  Save,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  AlertTriangle,
} from 'lucide-react'

import { analyticsApi, carsApi, slabsApi, salesApi, asList } from '../../api/endpoints'
import { parseError } from '../../api/client'
import { DonutChart, HorizontalBarChart, LineAreaChart } from '../../components/charts'
import { Button, Card, Skeleton, EmptyState, Badge } from '../../components/ui'
import { ExportMenu } from '../../components/ExportMenu'
import { TrendChip } from '../../components/TrendChip'
import { useToast } from '../../components/Toast'
import { useDebounce } from '../../lib/useDebounce'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { MONTHS, formatCurrency, formatNumber } from '../../lib/format'

const NOW = new Date()

function MetricTile({ icon: Icon, label, value, caption, tone = 'slate' }) {
  const tones = {
    slate: 'bg-surface-inset text-content',
    red: 'bg-toyota-50 text-toyota',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  }

  return (
    <Card className="p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-2xl font-extrabold text-content nums">{value}</div>
      <div className="mt-1 text-sm font-bold text-content">{label}</div>
      {caption && <div className="mt-1 text-xs leading-5 text-muted">{caption}</div>}
    </Card>
  )
}

function AnalyticsPanel({ title, subtitle, icon: Icon, children }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted" />
        <div>
          <h3 className="font-bold text-content">{title}</h3>
          {subtitle && <p className="mt-1 text-xs leading-5 text-muted">{subtitle}</p>}
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

  // Officers may only log the current month — past months are locked so the
  // analytics stay trustworthy (history is seeded server-side). The backend
  // enforces this too; here we simply pin the form to the current period.
  const month = NOW.getMonth() + 1
  const year = NOW.getFullYear()
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold text-content">My performance</h2>
            <TrendChip
              direction={officerSummary.mom_direction}
              pct={officerSummary.mom_pct}
              delta={officerSummary.mom_delta}
              prevLabel={officerSummary.prev_label}
            />
            {officerSummary.rank && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700"
                title={`${officerSummary.percentile}th percentile by cars sold`}
              >
                <Trophy className="h-3 w-3" />
                Rank #{officerSummary.rank} of {officerSummary.rank_total}
              </span>
            )}
            {officerSummary.streak > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                <Flame className="h-3 w-3" />
                {officerSummary.streak}-month streak
              </span>
            )}
            {officerSummary.pace_pct != null && officerCurrent.cars > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-soft px-2.5 py-0.5 text-[11px] font-bold text-muted">
                <TrendingUp className="h-3 w-3" />
                {officerSummary.pace_pct >= 0 ? '+' : ''}{officerSummary.pace_pct}% vs your avg
              </span>
            )}
            {officerSummary.ytd_payout != null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-soft px-2.5 py-0.5 text-[11px] font-bold text-muted">
                {officerSummary.ytd_year} YTD · {formatCurrency(officerSummary.ytd_payout)} · {formatNumber(officerSummary.ytd_cars)} cars
              </span>
            )}
          </div>
          <ExportMenu label="Export my sales" />
        </div>
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

        {officerCurrent.next_tier && officerCurrent.cars > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="text-sm leading-5 text-emerald-900">
              <span className="font-bold">{officerCurrent.label}:</span> you're saved at{' '}
              {formatNumber(officerCurrent.cars)} cars. Log{' '}
              <span className="font-bold">
                {officerCurrent.next_tier.cars_to_next} more{' '}
                {officerCurrent.next_tier.cars_to_next === 1 ? 'car' : 'cars'}
              </span>{' '}
              to reach the {officerCurrent.next_tier.label} tier (
              {formatCurrency(officerCurrent.next_tier.rate_per_car)}/car) —{' '}
              <span className="font-bold">+{formatCurrency(officerCurrent.next_tier.uplift)}</span> this month.
            </div>
          </div>
        )}

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
          <div className="border-b border-line bg-surface px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-content">Log monthly sales</h2>
              <p className="mt-1 text-sm text-muted">Enter cars sold per model. The payout updates live.</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-inset px-3 py-2 text-sm font-semibold text-content">
              <Calendar className="h-4 w-4 text-muted" />
              <span>{MONTHS[month - 1]} {year}</span>
              <span className="rounded-full bg-toyota-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-toyota">
                Current month
              </span>
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
                      val > 0 ? 'border-toyota/30 bg-toyota-50' : 'border-line bg-surface hover:border-line'
                    }`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-inset text-content">
                      <Car className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-content">{car.model_name}</div>
                      {car.variant && <div className="truncate text-xs text-muted">{car.variant}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => bump(car.id, -1)}
                        disabled={val <= 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors duration-200 cursor-pointer hover:border-line hover:text-content disabled:pointer-events-none disabled:opacity-40"
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
                        className="nums h-9 w-14 rounded-lg border border-line bg-surface text-center text-sm font-semibold text-content focus:border-toyota focus:outline-none focus:ring-4 focus:ring-toyota/10"
                      />
                      <button
                        onClick={() => bump(car.id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors duration-200 cursor-pointer hover:border-toyota hover:text-toyota"
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
            <h3 className="mb-3 text-xs font-bold uppercase text-muted">
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
                      hit ? 'bg-slate-950 text-white shadow-sm' : 'bg-surface-soft text-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold nums">{s.label}</span>
                      <span className={hit ? 'text-white/60' : 'text-muted'}>cars</span>
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
              <span className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
                <Wallet className="h-3.5 w-3.5" />
                Projected payout
              </span>
              <AnimatePresence>
                {calculating && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-muted"
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
                <div className="text-xs text-muted">cars sold</div>
              </div>
              <div className="h-8 w-px bg-surface/10" />
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
                    <div className="text-xl font-bold text-muted">—</div>
                    <div className="text-xs text-muted">no tier yet</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status / breakdown */}
          <div className="px-5 py-4">
            {totalCars === 0 ? (
              <div className="flex items-start gap-2 text-sm text-subtle">
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
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted">
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

          {/* Next-tier coaching: how many more cars unlock a better rate */}
          {calc?.next_tier && totalCars > 0 && (
            <div className="border-t border-white/10 px-5 py-4">
              <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 px-3 py-2.5">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div className="text-sm leading-5">
                  <span className="font-bold text-emerald-300">
                    Sell {calc.next_tier.cars_to_next} more {calc.next_tier.cars_to_next === 1 ? 'car' : 'cars'}
                  </span>
                  <span className="text-white/70">
                    {' '}to reach the {calc.next_tier.label} tier at {formatCurrency(calc.next_tier.rate_per_car)}/car —
                    {' '}
                    <span className="font-semibold text-white">
                      +{formatCurrency(calc.next_tier.uplift)}
                    </span>{' '}
                    on this month.
                  </span>
                </div>
              </div>
            </div>
          )}

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
