import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Spinner } from '../components/ui'

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-inset">
      <Spinner className="h-7 w-7" />
    </div>
  )
}

/** Gate a route by auth + (optionally) role. Redirects with a reason. */
export function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  if (role && user.role !== role) {
    // Logged in but wrong role — send to their own home with a message.
    const home = user.role === 'ADMIN' ? '/admin' : '/dashboard'
    return <Navigate to={home} replace state={{ unauthorized: true }} />
  }
  return children
}

/** Routes only for logged-out users (login/register). */
export function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
  }
  return children
}
