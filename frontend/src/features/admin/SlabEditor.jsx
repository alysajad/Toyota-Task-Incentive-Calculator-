import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus, Trash2, Save, CheckCircle2, AlertTriangle, RotateCcw, Infinity as InfinityIcon,
} from 'lucide-react'

import { slabsApi, asList } from '../../api/endpoints'
import { parseError } from '../../api/client'
import { Button, Card, Input, Skeleton, Badge } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatCurrency } from '../../lib/format'

let _id = 0
const nextId = () => `t${_id++}`

/** Derive inclusive [min,max] bounds for each tier from the chain. */
function withBounds(tiers) {
  let min = 1
  return tiers.map((t, i) => {
    const isLast = i === tiers.length - 1
    const max = isLast ? null : Number(t.max)
    const row = { ...t, min, max }
    min = (Number.isFinite(max) ? max : min) + 1
    return row
  })
}

const TIER_COLORS = [
  'from-toyota-700 to-toyota',
  'from-ink to-ink-600',
  'from-amber-600 to-amber-400',
  'from-emerald-700 to-emerald-500',
  'from-sky-700 to-sky-500',
  'from-violet-700 to-violet-500',
]

export default function SlabEditor() {
  const toast = useToast()
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState([])
  const [validating, setValidating] = useState(false)
  const debounceRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = asList(await slabsApi.list()).sort((a, b) => a.min_cars - b.min_cars)
      if (data.length === 0) {
        setTiers([{ id: nextId(), max: '', rate: '' }])
      } else {
        setTiers(
          data.map((s) => ({
            id: nextId(),
            max: s.max_cars ?? '',
            rate: String(s.rate_per_car),
          }))
        )
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const bounded = useMemo(() => withBounds(tiers), [tiers])

  // Build the payload the API understands.
  const payload = useMemo(
    () =>
      bounded.map((t) => ({
        min_cars: t.min,
        max_cars: t.max,
        rate_per_car: t.rate === '' ? 0 : Number(t.rate),
      })),
    [bounded]
  )

  // Local quick-checks (instant feedback before the server confirms).
  const localProblems = useMemo(() => {
    const problems = []
    bounded.forEach((t, i) => {
      if (t.rate === '' || Number(t.rate) < 0) problems.push(`Tier ${i + 1} needs a valid rate.`)
      if (t.max !== null && (t.max === '' || Number(t.max) < t.min))
        problems.push(`Tier ${i + 1}: cap must be ≥ ${t.min}.`)
    })
    return problems
  }, [bounded])

  // Debounced server-side dry-run validation (the live overlap/gap check).
  useEffect(() => {
    if (loading) return
    clearTimeout(debounceRef.current)
    if (localProblems.length) {
      setServerErrors([])
      return
    }
    setValidating(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await slabsApi.validate(payload)
        setServerErrors(res.valid ? [] : res.errors)
      } catch {
        /* network hiccup — keep last state */
      } finally {
        setValidating(false)
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [payload, localProblems, loading])

  const allErrors = [...localProblems, ...serverErrors]
  const isValid = allErrors.length === 0 && tiers.length > 0

  const update = (id, key, value) =>
    setTiers((ts) => ts.map((t) => (t.id === id ? { ...t, [key]: value } : t)))

  const addTier = () => {
    setTiers((ts) => {
      const copy = [...ts]
      const last = copy[copy.length - 1]
      // Turn the open-ended tier into a bounded one, append a new open-ended tier.
      const lastBounds = withBounds(copy)
      const lastMin = lastBounds[lastBounds.length - 1].min
      copy[copy.length - 1] = { ...last, max: String(lastMin) }
      copy.push({ id: nextId(), max: '', rate: last.rate || '' })
      return copy
    })
  }

  const removeTier = (id) =>
    setTiers((ts) => {
      if (ts.length <= 1) return ts
      const copy = ts.filter((t) => t.id !== id)
      // Ensure the final tier is open-ended.
      copy[copy.length - 1] = { ...copy[copy.length - 1], max: '' }
      return copy
    })

  const onSave = async () => {
    setSaving(true)
    try {
      await slabsApi.bulkReplace(payload)
      toast.success('Incentive slabs saved.')
      load()
    } catch (err) {
      const parsed = parseError(err)
      setServerErrors(parsed.errors?.slabs || [parsed.message])
      toast.error('Could not save — check the warnings.')
    } finally {
      setSaving(false)
    }
  }

  // Visual band proportions (open-ended gets a fixed flex weight).
  const bandSegments = bounded.map((t, i) => {
    const span = t.max === null ? 4 : Math.max(1, Number(t.max) - t.min + 1)
    return { ...t, span, color: TIER_COLORS[i % TIER_COLORS.length] }
  })
  const totalSpan = bandSegments.reduce((s, x) => s + x.span, 0) || 1

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-400">
        Define the tiered rate card. Tiers chain automatically from{' '}
        <span className="font-semibold text-ink">1 car</span> upward — the top tier is always
        open-ended. Overlaps and gaps are impossible by construction and verified live by the server.
      </p>

      {/* Visual tier band */}
      <Card className="overflow-hidden bg-ink bg-dotgrid-dark p-5 text-white">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Rate ladder
          </span>
          <span className="text-[11px] text-white/40">whole-slab model · every car paid at tier rate</span>
        </div>
        <div className="flex h-16 gap-1 overflow-hidden rounded-xl">
          {bandSegments.map((seg) => (
            <motion.div
              key={seg.id}
              layout
              className={`relative flex flex-col justify-center bg-gradient-to-br ${seg.color} px-3`}
              style={{ flexGrow: seg.span / totalSpan, minWidth: 64 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <span className="font-mono text-xs font-bold leading-none nums">
                {seg.max === null ? `${seg.min}+` : seg.min === seg.max ? seg.min : `${seg.min}–${seg.max}`}
              </span>
              <span className="mt-1 text-[10px] font-semibold leading-none text-white/80 nums">
                {seg.rate !== '' ? formatCurrency(seg.rate) : '—'}/car
              </span>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Editor rows */}
      <Card className="p-5">
        <div className="mb-4 hidden grid-cols-[40px_1fr_1fr_1fr_40px] items-center gap-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400 sm:grid">
          <span>#</span>
          <span>From (cars)</span>
          <span>Up to (cars)</span>
          <span>Rate / car (₹)</span>
          <span />
        </div>

        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {bounded.map((t, i) => {
              const isLast = i === bounded.length - 1
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-[1fr_1fr_40px] items-center gap-3 sm:grid-cols-[40px_1fr_1fr_1fr_40px]"
                >
                  <div className="hidden h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white sm:flex">
                    {i + 1}
                  </div>

                  {/* From (derived) */}
                  <div className="flex h-11 items-center rounded-xl border border-sand-200 bg-sand-100 px-3.5">
                    <span className="font-mono text-sm font-semibold text-ink nums">{t.min}</span>
                    <span className="ml-1.5 text-xs text-ink-400 sm:hidden">from</span>
                  </div>

                  {/* Up to */}
                  {isLast ? (
                    <div className="flex h-11 items-center gap-1.5 rounded-xl border border-dashed border-toyota/30 bg-toyota-50/50 px-3.5 text-toyota-700">
                      <InfinityIcon className="h-4 w-4" />
                      <span className="text-sm font-semibold">and above</span>
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min={t.min}
                      value={t.max}
                      onChange={(e) => update(t.id, 'max', e.target.value)}
                      placeholder={`${t.min}`}
                      invalid={t.max !== '' && Number(t.max) < t.min}
                      className="nums"
                    />
                  )}

                  {/* Rate */}
                  <Input
                    type="number"
                    min={0}
                    step="50"
                    value={t.rate}
                    onChange={(e) => update(t.id, 'rate', e.target.value)}
                    placeholder="1000"
                    invalid={t.rate !== '' && Number(t.rate) < 0}
                    className="nums"
                  />

                  <button
                    onClick={() => removeTier(t.id)}
                    disabled={tiers.length <= 1}
                    className="flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-ink-400 transition-colors hover:bg-toyota-50 hover:text-toyota disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="Remove tier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <button
          onClick={addTier}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sand-300 py-3 text-sm font-semibold text-ink-400 transition-colors hover:border-toyota/40 hover:bg-toyota-50/40 hover:text-toyota"
        >
          <Plus className="h-4 w-4" />
          Add tier
        </button>
      </Card>

      {/* Validation + save bar */}
      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <Card className="flex flex-col gap-3 p-4 shadow-float sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            {validating ? (
              <Badge tone="neutral">Checking…</Badge>
            ) : isValid ? (
              <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Configuration valid
              </span>
            ) : (
              <div className="flex items-start gap-2 text-sm text-toyota-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <ul className="space-y-0.5">
                  {allErrors.slice(0, 3).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="md" onClick={load} disabled={saving}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button size="md" onClick={onSave} loading={saving} disabled={!isValid}>
              <Save className="h-4 w-4" />
              Save slabs
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
