import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button, Field, Input } from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { authApi } from '../../api/endpoints'
import { parseError } from '../../api/client'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoCredentials, setDemoCredentials] = useState([])
  const [demoLoading, setDemoLoading] = useState(true)

  const unauthorized = location.state?.unauthorized

  useEffect(() => {
    let active = true

    authApi.demoCredentials()
      .then((data) => {
        if (active) setDemoCredentials(data.credentials ?? [])
      })
      .catch(() => {
        if (active) setDemoCredentials([])
      })
      .finally(() => {
        if (active) setDemoLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const fillDemoCredential = (credential) => {
    setError('')
    setForm({ email: credential.email, password: credential.password })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form)
      navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      setError(parseError(err).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mb-7">
        <div className="mb-2 text-xs font-bold uppercase text-toyota">
          Secure sign in
        </div>
        <h2 className="text-3xl font-extrabold text-slate-950">
          Welcome back
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter your approved account details to continue.
        </p>
      </div>

      {unauthorized && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Access denied for that route. You were redirected to your own workspace.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@nippon.test"
            value={form.email}
            onChange={onChange}
            required
            autoFocus
          />
        </Field>
        <Field label="Password">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={form.password}
            onChange={onChange}
            required
          />
        </Field>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Sign in
          {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />}
        </Button>
      </form>

      {(demoLoading || demoCredentials.length > 0) && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Demo access
            </div>
            {demoLoading && (
              <span className="text-xs font-semibold text-slate-400">Loading</span>
            )}
          </div>

          <div className="space-y-2">
            {demoCredentials.map((credential) => (
              <button
                key={`${credential.role}-${credential.email}`}
                type="button"
                onClick={() => fillDemoCredential(credential)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-toyota/40 hover:bg-toyota-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-toyota/15"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-extrabold text-slate-950">
                    {credential.label || credential.role_label}
                  </span>
                  {credential.employee_code && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                      {credential.employee_code}
                    </span>
                  )}
                </div>
                <div className="mt-1 break-all text-xs font-semibold text-slate-600">
                  {credential.email}
                </div>
                <div className="mt-0.5 break-all text-xs font-semibold text-toyota">
                  {credential.password}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        New sales officer?{' '}
        <Link to="/register" className="font-semibold text-toyota hover:text-toyota-700">
          Request access
        </Link>
      </p>
    </AuthLayout>
  )
}
