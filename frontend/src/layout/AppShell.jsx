import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Logo, Mark } from '../components/Logo'
import { cn } from '../components/ui'
import { fullName, initials } from '../lib/format'

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold',
          'transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
          isActive
            ? 'bg-white text-slate-950 shadow-sm'
            : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-toyota transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
          />
          <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-toyota' : 'text-slate-400')} />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function TabItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-bold',
          'transition-colors duration-200 cursor-pointer',
          isActive ? 'text-toyota' : 'text-slate-500'
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  )
}

export function AppShell({ nav }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const active = [...nav]
    .filter((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))
    .sort((a, b) => b.to.length - a.to.length)[0]
  const title = active?.label || 'Console'
  const roleLabel = user?.role === 'ADMIN' ? 'Administrator' : 'Sales Officer'

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col bg-slate-950 lg:flex">
        <div className="px-5 py-6">
          <Logo />
        </div>

        <div className="mx-3 mb-5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <div className="text-[11px] font-bold uppercase text-slate-500">Workspace</div>
          <div className="mt-1 text-sm font-semibold text-white">{roleLabel}</div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-extrabold text-slate-950">
              {initials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{fullName(user)}</div>
              <div className="truncate text-xs text-slate-500">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-400 transition-colors duration-200 cursor-pointer hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Mark className="!h-8 !w-8 lg:hidden" />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-extrabold text-slate-950 sm:text-xl">
                  {title}
                </h1>
                <p className="hidden text-xs font-medium text-slate-500 sm:block">
                  Nippon Toyota incentive operations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 sm:inline-flex">
                {roleLabel}
              </span>
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 cursor-pointer hover:bg-slate-100 hover:text-slate-950 lg:hidden"
                aria-label="Sign out"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 shadow-[0_-12px_30px_-24px_rgba(15,23,42,0.5)] backdrop-blur-xl lg:hidden">
        {nav.map((item) => (
          <TabItem key={item.to} {...item} />
        ))}
      </nav>
    </div>
  )
}
