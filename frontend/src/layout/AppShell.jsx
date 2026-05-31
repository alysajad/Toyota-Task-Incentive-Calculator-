import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Logo, Mark } from '../components/Logo'
import { cn } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
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
            ? 'bg-surface text-content shadow-sm'
            : 'text-subtle hover:bg-surface/[0.08] hover:text-white'
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
          <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-toyota' : 'text-subtle')} />
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
          isActive ? 'text-toyota' : 'text-muted'
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
    <div className="min-h-screen bg-surface-soft">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col bg-slate-950 lg:flex">
        <div className="px-5 py-6">
          <Logo />
        </div>

        <div className="mx-3 mb-5 rounded-xl border border-white/10 bg-surface/[0.04] px-3 py-3">
          <div className="text-[11px] font-bold uppercase text-muted">Workspace</div>
          <div className="mt-1 text-sm font-semibold text-white">{roleLabel}</div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-sm font-extrabold text-content">
              {initials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{fullName(user)}</div>
              <div className="truncate text-xs text-muted">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-subtle transition-colors duration-200 cursor-pointer hover:bg-surface/[0.08] hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Mark className="!h-8 !w-8 lg:hidden" />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-extrabold text-content sm:text-xl">
                  {title}
                </h1>
                <p className="hidden text-xs font-medium text-muted sm:block">
                  Nippon Toyota incentive operations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-line bg-surface-soft px-3 py-1 text-xs font-bold text-content sm:inline-flex">
                {roleLabel}
              </span>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors duration-200 cursor-pointer hover:bg-surface-inset hover:text-content lg:hidden"
                aria-label="Sign out"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-[calc(7rem_+_env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-24px_rgba(15,23,42,0.5)] backdrop-blur-xl lg:hidden">
        {nav.map((item) => (
          <TabItem key={item.to} {...item} />
        ))}
      </nav>
    </div>
  )
}
