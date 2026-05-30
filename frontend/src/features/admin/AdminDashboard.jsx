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
  Trophy,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'

import { analyticsApi } from '../../api/endpoints'
import {
  DonutChart,
  HorizontalBarChart,
  LineAreaChart,
  StackedBarChart,
} from '../../components/charts'
import { Card, Skeleton, Badge, Button, EmptyState } from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { fullName, formatCurrency, formatNumber } from '../../lib/format'

const quickLinks = [
  { to: '/admin/cars', label: 'Manage inventory', icon: Car },
  { to: '/admin/slabs', label: 'Tune slabs', icon: Layers },
  { to: '/admin/approvals', label: 'Review officers', icon: UserCheck },
]

function AnalyticsCard({ label, value, caption, icon: Icon, tone = 'slate', to }) {
  const toneClasses = {
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-toyota-50 text-toyota',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  }

  const body = (
    <Card className="group h-full p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-float">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {to && <ArrowUpRight className="h-4 w-4 text-slate-400 transition-colors group-hover:text-toyota" />}
      </div>
      <div className="mt-4 text-2xl font-extrabold text-slate-950 nums">{value}</div>
      <div className="mt-1 text-sm font-bold text-slate-800">{label}</div>
      {caption && <div className="mt-1 text-xs leading-5 text-slate-500">{caption}</div>}
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
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-slate-500" />}
            <h3 className="font-bold text-slate-950">{title}</h3>
          </div>
          {subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}
        </div>
        {action}
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
  const current = analytics?.current_month || {}
  const modelMix = analytics?.model_mix || []
  const monthlyTrend = analytics?.monthly_trend || []
  const leaderboard = analytics?.officer_leaderboard || []
  const slabDistribution = analytics?.slab_distribution || []
  const pipeline = analytics?.approval_pipeline || []
  const inventory = analytics?.inventory_status || []
  const recentEntries = analytics?.recent_entries || []

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
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Welcome back, {fullName(user).split(' ')[0]}. Track sales volume, payout exposure, top officers, model demand, tier usage, and approval health from the records already saved in the system.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {quickLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-white/[0.08]"
                >
                  <Icon className="h-4 w-4 text-toyota-200" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsCard
          label="Total payout exposure"
          value={formatCurrency(summary.total_payout)}
          caption={`${formatNumber(summary.submissions)} submitted month${summary.submissions === 1 ? '' : 's'}`}
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
          subtitle="Last six months with submitted entries"
          icon={BarChart3}
          action={
            <Badge tone="neutral">
              {current.label || 'Current month'} · {formatNumber(current.cars)} cars
            </Badge>
          }
        >
          <LineAreaChart
            data={monthlyTrend}
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
            <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">No officer submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((officer, index) => (
                <div key={officer.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-extrabold text-white nums">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-950">{officer.name}</div>
                    <div className="truncate text-xs text-slate-500">{officer.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-slate-950 nums">
                      {formatCurrency(officer.total_payout)}
                    </div>
                    <div className="text-xs text-slate-500">{formatNumber(officer.cars)} cars</div>
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
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-slate-500">
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
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                <span>Inventory status</span>
                <span>{formatNumber(inventoryTotal)} models</span>
              </div>
              <StackedBarChart data={inventoryChart} valueKey="count" labelKey="label" />
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Recent submissions"
        subtitle="Latest saved sales months across officers"
        icon={Clock3}
      >
        {recentEntries.length === 0 ? (
          <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">No submitted months yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                  <th className="pb-3">Officer</th>
                  <th className="pb-3">Month</th>
                  <th className="pb-3 text-right">Cars</th>
                  <th className="pb-3">Tier</th>
                  <th className="pb-3 text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-slate-50">
                    <td className="py-3">
                      <div className="font-bold text-slate-950">{entry.officer}</div>
                      <div className="text-xs text-slate-500">{entry.email}</div>
                    </td>
                    <td className="py-3 font-semibold text-slate-700">{entry.label}</td>
                    <td className="py-3 text-right font-mono font-bold nums">{formatNumber(entry.cars)}</td>
                    <td className="py-3">
                      <Badge tone={entry.slab === 'No tier' ? 'neutral' : 'red'}>{entry.slab}</Badge>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-950 nums">
                      {formatCurrency(entry.total_payout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
