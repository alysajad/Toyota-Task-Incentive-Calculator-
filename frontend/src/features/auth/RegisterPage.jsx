import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, UserPlus } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button, Field, Input } from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { parseError } from '../../api/client'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    employee_code: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      setSuccess(true)
    } catch (err) {
      setError(parseError(err).message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-950">
            Request received
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your account is <span className="font-semibold text-slate-900">pending admin approval</span>.
            You'll be cleared to sign in once an administrator grants access.
          </p>
          <Button onClick={() => navigate('/login')} className="mt-6 w-full" size="lg">
            Back to sign in
          </Button>
        </motion.div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <div className="mb-2 text-xs font-bold uppercase text-toyota">
          Sales officer access
        </div>
        <h2 className="text-3xl font-extrabold text-slate-950">
          Create account
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Submit your details for administrator approval.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input name="first_name" value={form.first_name} onChange={onChange} required autoFocus />
          </Field>
          <Field label="Last name">
            <Input name="last_name" value={form.last_name} onChange={onChange} required />
          </Field>
        </div>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" placeholder="you@nippon.test" value={form.email} onChange={onChange} required />
        </Field>
        <Field label="Employee code" hint="Optional - provided by your branch.">
          <Input name="employee_code" value={form.employee_code} onChange={onChange} />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="new-password" placeholder="Min. 8 characters" value={form.password} onChange={onChange} required />
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
          Create account
          {!loading && <UserPlus className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-toyota hover:text-toyota-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
