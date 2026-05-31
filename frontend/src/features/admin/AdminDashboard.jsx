import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Car,
  Clock3,
  Layers,
  PieChart,
  Percent,
  Search,
  Trophy,
  UserCheck,
  UserX,
  Users,
  Wallet,
} from 'lucide-react'

import { analyticsApi } from '../../api/endpoints'
import { ExportMenu } from '../../components/ExportMenu'
import { TrendChip } from '../../components/TrendChip'
import {
  DonutChart,
  HorizontalBarChart,
  LineAreaChart,
  StackedBarChart,
} from '../../components/charts'
import { Card, Skeleton, Badge, Button, EmptyState, Select } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../auth/AuthContext'
import { fullName, formatCurrency, formatNumber } from '../../lib/format'

const quickLinks = [
  { to: '/admin/cars', label: 'Manage inventory', icon: Car },
  { to: '/admin/slabs', label: 'Tune slabs', icon: Layers },
  { to: '/admin/approvals', label: 'Review officers', icon: UserCheck },
]

function AnalyticsCard({ label, value, caption, icon: Icon, tone = 'slate', to }) {
  const toneClasses = {
    slate: 'bg-surface-inset text-content',
    red: 'bg-toyota-50 text-toyota',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  }

  const body = (
    <Card className="group h-full p-4 transition-colors duration-200 hover:border-line hover:shadow-float">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {to && <ArrowUpRight className="h-4 w-4 text-subtle transition-colors group-hover:text-toyota" />}
      </div>
      <div className="mt-4 text-2xl font-extrabold text-content nums">{value}</div>
      <div className="mt-1 text-sm font-bold text-content">{label}</div>
      {caption && <div className="mt-1 text-xs leading-5 text-muted">{caption}</div>}
    </Card>
  )

  return to ? (
    <Link to={to} className="block h-full cursor-pointer">
      {body}
    </Link>
  ) : (
    body
  )
}

function Panel({ title, subtitle, icon: Icon, action, children, className }) {
  return (
    <Card className={`p-5 ${className || ''}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted" />}
            <h3 className="font-bold text-content">{title}</h3>
          </div>
          {subtitle && <p className="mt-1 text-xs leading-5 text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  )
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-36 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trendMonths, setTrendMonths] = useState(6)
  const [officerQuery, setOfficerQuery] = useState('')
  const [officerSort, setOfficerSort] = useState('payout')
  const [selectedOfficer, setSelectedOfficer] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setAnalytics(await analyticsApi.admin())
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not load admin analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const summary = analytics?.summary || {}
  const modelMix = analytics?.model_mix || []
  const monthlyTrend = analytics?.monthly_trend || []
  const leaderboard = analytics?.officer_leaderboard || []
  const slabDistribution = analytics?.slab_distribution || []
  const pipeline = analytics?.approval_pipeline || []
  const inventory = analytics?.inventory_status || []
  const recentEntries = analytics?.recent_entries || []
  const concentration = analytics?.payout_concentration || {}
  const atRisk = analytics?.at_risk_officers || []
  const officerTable = analytics?.officer_table || []
  const comparison = analytics?.monthly_comparison || []

  const comparisonWindow = comparison.slice(-trendMonths)
  const officerQ = officerQuery.trim().toLowerCase()
  const filteredOfficers = officerTable
    .filter(
      (o) =>
        !officerQ ||
        o.name.toLowerCase().includes(officerQ) ||
        o.email.toLowerCase().includes(officerQ) ||
        (o.employee_code || '').toLowerCase().includes(officerQ),
    )
    .sort((a, b) => {
      if (officerSort === 'name') return a.name.localeCompare(b.name)
      if (officerSort === 'cars') return b.cars - a.cars
      return Number(b.total_payout) - Number(a.total_payout)
    })

  const pipelineTotal = pipeline.reduce((sum, item) => sum + Number(item.count || 0), 0)
  const inventoryTotal = inventory.reduce((sum, item) => sum + Number(item.count || 0), 0)
  const pipelineChart = pipeline.map((item) => ({
    ...item,
    color:
      item.status === 'APPROVED'
        ? '#10b981'
        : item.status === 'PENDING'
          ? '#f59e0b'
          : '#eb0a1e',
  }))
  const inventoryChart = inventory.map((item) => ({
    ...item,
    color: item.label === 'Active' ? '#10b981' : '#64748b',
  }))

  if (loading) return <LoadingDashboard />

  if (error) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Couldn't load analytics"
        description={error}
        action={<Button onClick={load} size="sm">Retry</Button>}
      />
    )
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-float"
      >
        <div className="dash-grid p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-toyota-200">Admin analytics</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-extrabold sm:text-3xl">
                Live incentive performance from your current database.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">
                Welcome back, {fullName(user).split(' ')[0]}. Track sales volume, payout exposure, top officers, model demand, tier usage, and approval health from the records already saved in the system.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <TrendChip
                  direction={summary.mom_direction}
                  pct={summary.mom_pct}
                  delta={summary.mom_delta}
                  prevLabel={summary.prev_label}
                />
                {summary.ytd_payout != null && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-surface/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-slate-200">
                    {summary.ytd_year} YTD · {formatCurrency(summary.ytd_payout)} · {formatNumber(summary.ytd_cars)} cars
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <ExportMenu label="Export sales CSV" size="md" />
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {quickLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface/[0.04] px-3 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-surface/[0.08]"
                  >
                    <Icon className="h-4 w-4 text-toyota-200" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsCard
          label="Total payout exposure"
          value={formatCurrency(summary.total_payout)}
          caption={`${formatNumber(summary.active_officers)} active officer${summary.active_officers === 1 ? '' : 's'} · ${formatCurrency(summary.avg_payout_per_officer)} avg`}
          icon={Wallet}
          tone="red"
        />
        <AnalyticsCard
          label="Cars sold"
          value={formatNumber(summary.total_cars)}
          caption={`${formatNumber(summary.avg_cars_per_submission)} avg cars per submission`}
          icon={Activity}
          tone="blue"
        />
        <AnalyticsCard
          label="Active models"
          value={formatNumber(summary.active_models)}
          caption={`${formatNumber(summary.retired_models)} retired models`}
          icon={Car}
          tone="slate"
          to="/admin/cars"
        />
        <AnalyticsCard
          label="Pending approvals"
          value={formatNumber(summary.pending_officers)}
          caption={`${formatNumber(summary.approved_officers)} approved officers`}
          icon={UserCheck}
          tone={summary.pending_officers > 0 ? 'amber' : 'green'}
          to="/admin/approvals"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <Panel
          title="Monthly sales trend"
          subtitle={`Last ${trendMonths} months with submitted entries`}
          icon={BarChart3}
          action={
            <Select
              value={trendMonths}
              onChange={(e) => setTrendMonths(Number(e.target.value))}
              className="w-28"
              aria-label="Trend range"
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </Select>
          }
        >
          <LineAreaChart
            data={comparisonWindow.length ? comparisonWindow : monthlyTrend}
            valueKey="cars"
            labelKey="label"
            formatValue={(value) => `${formatNumber(value)} cars`}
          />
        </Panel>

        <Panel
          title="Officer leaderboard"
          subtitle="Ranked by total payout, then cars sold"
          icon={Trophy}
        >
          {leaderboard.length === 0 ? (
            <p className="rounded-xl bg-surface-soft py-8 text-center text-sm text-muted">No officer submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((officer, index) => (
                <div key={officer.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-extrabold text-white nums">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-content">{officer.name}</div>
                    <div className="truncate text-xs text-muted">{officer.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-content nums">
                      {formatCurrency(officer.total_payout)}
                    </div>
                    <div className="text-xs text-muted">{formatNumber(officer.cars)} cars</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Model sales mix" subtitle="Top models by cars sold" icon={PieChart}>
          <HorizontalBarChart
            data={modelMix}
            valueKey="cars"
            labelKey="model"
            empty="No model sales yet."
            detail={(item) =>
              `${item.variant || 'Base variant'} · ${formatNumber(item.submissions)} submission${item.submissions === 1 ? '' : 's'}`
            }
          />
        </Panel>

        <Panel title="Tier distribution" subtitle="Entries grouped by matched slab" icon={Layers}>
          <DonutChart
            data={slabDistribution}
            valueKey="cars"
            labelKey="label"
            centerLabel="Cars"
          />
          <StackedBarChart
            data={slabDistribution}
            valueKey="entries"
            labelKey="label"
            formatValue={formatNumber}
          />
        </Panel>

        <Panel title="Approval and inventory health" subtitle="Operational queues at a glance" icon={Users}>
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-muted">
                <span>Officer pipeline</span>
                <span>{formatNumber(pipelineTotal)} total</span>
              </div>
              <DonutChart
                data={pipelineChart}
                valueKey="count"
                labelKey="label"
                centerLabel="Officers"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-muted">
                <span>Inventory status</span>
                <span>{formatNumber(inventoryTotal)} models</span>
              </div>
              <StackedBarChart data={inventoryChart} valueKey="count" labelKey="label" />
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Month-over-month comparison"
        subtitle="Payout exposure across recent months"
        icon={BarChart3}
        action={
          <Select
            value={trendMonths}
            onChange={(e) => setTrendMonths(Number(e.target.value))}
            className="w-28"
            aria-label="Comparison range"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </Select>
        }
      >
        <HorizontalBarChart
          data={[...comparisonWindow].reverse()}
          valueKey="total_payout"
          labelKey="label"
          empty="No monthly data yet."
          formatValue={formatCurrency}
          detail={(item) =>
            `${formatNumber(item.cars)} cars · ${formatNumber(item.submissions)} submission${item.submissions === 1 ? '' : 's'}`
          }
        />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Team participation" subtitle="Officers logging sales this month" icon={Percent}>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-extrabold text-content nums">{summary.participation_rate ?? 0}%</div>
            <div className="pb-1 text-sm text-muted">
              {formatNumber(summary.participation_submitted)} of {formatNumber(summary.participation_total)} approved
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-inset">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(100, summary.participation_rate || 0)}%` }}
            />
          </div>
          <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Top officer share</span>
              <span className="font-mono font-bold text-content nums">{concentration.top_officer_share ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Top 3 officers</span>
              <span className="font-mono font-bold text-content nums">{concentration.top3_officer_share ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="truncate text-muted">Top model ({concentration.top_model || '—'})</span>
              <span className="font-mono font-bold text-content nums">{concentration.top_model_share ?? 0}%</span>
            </div>
          </div>
        </Panel>

        <Panel title="At-risk officers" subtitle="Approved but no sales logged this month" icon={UserX}>
          {atRisk.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 py-8 text-center text-sm font-semibold text-emerald-700">
              Everyone with an approved account has logged sales this month.
            </p>
          ) : (
            <div className="scroll-thin max-h-72 space-y-2 overflow-y-auto">
              {atRisk.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-content">{o.name}</div>
                    <div className="truncate text-xs text-muted">
                      {o.email}{o.employee_code ? ` · ${o.employee_code}` : ''}
                    </div>
                  </div>
                  <Badge tone={o.last_active === 'Never' ? 'red' : 'amber'}>
                    {o.last_active === 'Never' ? 'Never logged' : `Last: ${o.last_active}`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="All officers"
        subtitle="Search, sort, and open any officer for detail"
        icon={Users}
        action={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={officerQuery}
                onChange={(e) => setOfficerQuery(e.target.value)}
                placeholder="Search officers"
                className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm focus:border-toyota focus:outline-none focus:ring-4 focus:ring-toyota/10 sm:w-40"
              />
            </div>
            <Select value={officerSort} onChange={(e) => setOfficerSort(e.target.value)} className="w-32 shrink-0" aria-label="Sort officers">
              <option value="payout">By payout</option>
              <option value="cars">By cars</option>
              <option value="name">By name</option>
            </Select>
          </div>
        }
      >
        {filteredOfficers.length === 0 ? (
          <p className="rounded-xl bg-surface-soft py-8 text-center text-sm text-muted">No officers match your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-bold uppercase text-muted">
                  <th className="pb-3">Officer</th>
                  <th className="pb-3 text-right">Cars</th>
                  <th className="pb-3 text-right">Months</th>
                  <th className="pb-3 text-right">Avg/mo</th>
                  <th className="pb-3">Last active</th>
                  <th className="pb-3 text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredOfficers.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOfficer(o)}
                    className="cursor-pointer transition-colors hover:bg-surface-soft"
                  >
                    <td className="py-3">
                      <div className="font-bold text-content">{o.name}</div>
                      <div className="text-xs text-muted">{o.email}</div>
                    </td>
                    <td className="py-3 text-right font-mono font-bold nums">{formatNumber(o.cars)}</td>
                    <td className="py-3 text-right nums">{formatNumber(o.submissions)}</td>
                    <td className="py-3 text-right nums">{formatNumber(o.avg_cars)}</td>
                    <td className="py-3 text-muted">{o.last_active}</td>
                    <td className="py-3 text-right font-mono font-bold text-content nums">{formatCurrency(o.total_payout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Recent submissions"
        subtitle="Latest saved sales months across officers"
        icon={Clock3}
      >
        {recentEntries.length === 0 ? (
          <p className="rounded-xl bg-surface-soft py-8 text-center text-sm text-muted">No submitted months yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-bold uppercase text-muted">
                  <th className="pb-3">Officer</th>
                  <th className="pb-3">Month</th>
                  <th className="pb-3 text-right">Cars</th>
                  <th className="pb-3">Tier</th>
                  <th className="pb-3 text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-surface-soft">
                    <td className="py-3">
                      <div className="font-bold text-content">{entry.officer}</div>
                      <div className="text-xs text-muted">{entry.email}</div>
                    </td>
                    <td className="py-3 font-semibold text-content">{entry.label}</td>
                    <td className="py-3 text-right font-mono font-bold nums">{formatNumber(entry.cars)}</td>
                    <td className="py-3">
                      <Badge tone={entry.slab === 'No tier' ? 'neutral' : 'red'}>{entry.slab}</Badge>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-content nums">
                      {formatCurrency(entry.total_payout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={!!selectedOfficer}
        onClose={() => setSelectedOfficer(null)}
        title={selectedOfficer?.name}
        description={selectedOfficer?.email}
      >
        {selectedOfficer && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total payout', value: formatCurrency(selectedOfficer.total_payout) },
              { label: 'Cars sold', value: formatNumber(selectedOfficer.cars) },
              { label: 'Months logged', value: formatNumber(selectedOfficer.submissions) },
              { label: 'Avg cars / month', value: formatNumber(selectedOfficer.avg_cars) },
              { label: 'Last active', value: selectedOfficer.last_active },
              { label: 'Employee code', value: selectedOfficer.employee_code || '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-surface-soft px-3 py-3">
                <div className="text-xs font-semibold text-muted">{s.label}</div>
                <div className="mt-1 text-lg font-extrabold text-content nums">{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
