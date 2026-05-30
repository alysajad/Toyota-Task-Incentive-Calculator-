import { motion } from 'framer-motion'
import { BarChart3, ShieldCheck, TimerReset } from 'lucide-react'
import { Logo } from '../../components/Logo'

const highlights = [
  { icon: BarChart3, label: 'Live slab calculation', value: 'Server verified' },
  { icon: ShieldCheck, label: 'Role-based access', value: 'Admin + Officer' },
  { icon: TimerReset, label: 'Monthly workflow', value: 'Fast closeout' },
]

function PreviewPanel() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase text-slate-500">Projected payout</div>
          <div className="mt-2 text-4xl font-extrabold text-white nums">₹28,000</div>
        </div>
        <span className="rounded-full border border-toyota/30 bg-toyota/15 px-3 py-1 text-xs font-bold text-toyota-100">
          8+ tier
        </span>
      </div>

      <div className="mt-6 grid grid-cols-8 gap-1.5">
        {[38, 52, 46, 65, 58, 78, 70, 92].map((height, index) => (
          <div key={index} className="flex h-24 items-end rounded bg-white/5 px-1">
            <div
              className="w-full rounded-sm bg-gradient-to-t from-toyota to-red-300"
              style={{ height: `${height}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {['1-3', '4-7', '8+'].map((tier, index) => (
          <div key={tier} className="rounded-xl bg-white/[0.05] px-3 py-2">
            <div className="text-xs font-bold text-slate-500">Tier {index + 1}</div>
            <div className="mt-1 text-sm font-extrabold text-white nums">{tier}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AuthLayout({ children }) {
  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[1fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="dash-grid absolute inset-0 opacity-35" />
        <div className="race-stripes absolute inset-y-0 right-0 w-1.5" />

        <div className="relative flex min-h-screen flex-col justify-between p-12">
          <Logo />

          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <p className="text-sm font-bold uppercase text-toyota-200">Incentive operations</p>
              <h1 className="mt-4 max-w-lg text-5xl font-extrabold leading-[1.05] text-white">
                Calculate rewards with clean, auditable sales data.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
                Admins maintain the rate card. Officers log monthly volume. The payout engine keeps every total aligned with the configured slab model.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-3">
              {highlights.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-toyota">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{label}</div>
                    <div className="text-xs font-medium text-slate-500">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <PreviewPanel />
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div className="mb-6 flex justify-center lg:hidden">
            <Logo variant="ink" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-float sm:p-8">
            {children}
          </div>
        </motion.div>
      </section>
    </div>
  )
}

export default AuthLayout
