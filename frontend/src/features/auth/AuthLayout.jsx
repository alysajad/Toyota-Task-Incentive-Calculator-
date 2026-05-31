import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, ClipboardCheck, KeyRound, ShieldCheck, TimerReset, UserCheck } from 'lucide-react'
import { Logo } from '../../components/Logo'
import { cn } from '../../components/ui'

const highlights = [
  { icon: BarChart3, label: 'Live slab calculation' },
  { icon: ShieldCheck, label: 'Role-based access' },
  { icon: TimerReset, label: 'Monthly workflow' },
]

const navItems = [
  { to: '/login', label: 'Home' },
  { to: '/register', label: 'Join' },
]

const workflowSteps = [
  { icon: UserCheck, label: 'Identity', value: 'Approved account' },
  { icon: KeyRound, label: 'Routing', value: 'Role workspace' },
  { icon: ClipboardCheck, label: 'Audit', value: 'Traceable records' },
]

function VisualPanel() {
  return (
    <section className="relative order-first h-44 w-full overflow-hidden bg-slate-950 sm:h-56 md:h-64 lg:order-none lg:h-auto lg:min-h-[720px]">
      <img
        src="/auth-showroom.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-slate-950/20" />
      {/* Top scrim so the overlaid logo stays readable on the mobile banner. */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/70 to-transparent lg:hidden" />

      <div className="absolute bottom-9 left-14 hidden w-[23rem] rounded-2xl border border-white/70 bg-white/80 p-4 shadow-2xl shadow-slate-950/10 backdrop-blur-xl lg:block">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase text-slate-500">Access flow</div>
            <div className="mt-1 text-lg font-extrabold text-slate-950">Verified before payout data</div>
          </div>
          <span className="rounded-full border border-toyota/20 bg-toyota-50 px-3 py-1 text-xs font-bold text-toyota">
            Secure
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {workflowSteps.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-slate-200/80 bg-white/75 px-3 py-3">
              <Icon className="h-5 w-5" />
              <div className="mt-3 text-xs font-extrabold text-slate-950">{label}</div>
              <div className="mt-0.5 text-[11px] font-medium leading-4 text-slate-500">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-12 right-12 hidden grid-cols-3 gap-1.5 lg:grid">
        <span className="h-3 w-3 rounded-full bg-white shadow-sm" />
        <span className="h-3 w-3 rounded-full bg-white shadow-sm" />
        <span className="h-3 w-3 rounded-full bg-white shadow-sm" />
      </div>
    </section>
  )
}

export function AuthLayout({ children }) {
  const location = useLocation()

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 px-4 py-5 sm:px-6 lg:px-10">
      <main className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className="relative flex w-full flex-col overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.45)] lg:grid lg:min-h-[720px] lg:grid-cols-[0.92fr_1.08fr]"
        >
          <header className="absolute inset-x-0 top-0 z-20 flex h-24 items-center justify-between px-6 sm:px-10 lg:px-12">
            <Logo variant="light" className="lg:hidden" />
            <Logo variant="ink" className="hidden lg:block" />
            <nav className="hidden items-center gap-10 text-sm font-semibold lg:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'transition-colors duration-200 hover:text-toyota',
                    location.pathname === item.to ? 'text-slate-950' : 'text-slate-400',
                  )}
                  aria-current={location.pathname === item.to ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <section className="relative z-10 flex items-center px-6 pb-9 pt-9 sm:px-12 lg:min-h-[720px] lg:px-16 lg:pt-28">
            <div className="w-full max-w-md">
              {children}

              <div className="mt-7 grid gap-2 sm:grid-cols-3">
                {highlights.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-toyota" />
                    <span className="text-[11px] font-bold leading-4 text-slate-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <VisualPanel />
        </motion.div>
      </main>
    </div>
  )
}

export default AuthLayout
