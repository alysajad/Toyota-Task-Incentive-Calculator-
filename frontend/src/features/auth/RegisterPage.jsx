import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, UserPlus } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button, Field, Input } from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { parseError } from '../../api/client'

const EMAIL_PATTERN = /^[^\s@]+@nippon\.test$/i
const EMPLOYEE_CODE_PATTERN = /^SO-[0-9]+$/

function firstError(errors, field) {
  const error = errors?.[field]
  return Array.isArray(error) ? error[0] : error
}

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
  const [fieldErrors, setFieldErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const onChange = (e) => {
    const { name } = e.target
    let { value } = e.target

    if (name === 'employee_code') {
      value = value.toUpperCase().replace(/\s/g, '')
    }
    if (name === 'email') {
      value = value.trim().toLowerCase()
    }

    setForm((f) => ({ ...f, [name]: value }))
    setFieldErrors((errors) => ({ ...errors, [name]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const payload = {
      ...form,
      email: form.email.trim().toLowerCase(),
      employee_code: form.employee_code.trim().toUpperCase(),
    }

    const nextErrors = {}
    if (!EMAIL_PATTERN.test(payload.email)) {
      nextErrors.email = 'Use your @nippon.test email address.'
    }
    if (!EMPLOYEE_CODE_PATTERN.test(payload.employee_code)) {
      nextErrors.employee_code = 'Employee code must look like SO-104.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setError('Fix the highlighted fields to request access.')
      return
    }

    setLoading(true)
    try {
      await register(payload)
      setSuccess(true)
    } catch (err) {
      const parsed = parseError(err)
      setError(parsed.message)
      setFieldErrors(parsed.errors || {})
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
          Submit your Nippon Toyota email and assigned sales officer code for administrator approval.
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
        <Field label="Email" hint="Sales officer accounts must use @nippon.test." error={firstError(fieldErrors, 'email')}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@nippon.test"
            value={form.email}
            onChange={onChange}
            pattern="^[^\s@]+@nippon\.test$"
            title="Use your @nippon.test email address."
            invalid={!!fieldErrors.email}
            required
          />
        </Field>
        <Field label="Employee code" hint="Format: SO-<serial number>, for example SO-104." error={firstError(fieldErrors, 'employee_code')}>
          <Input
            name="employee_code"
            value={form.employee_code}
            onChange={onChange}
            placeholder="SO-104"
            pattern="^SO-[0-9]+$"
            title="Employee code must look like SO-104."
            autoCapitalize="characters"
            invalid={!!fieldErrors.employee_code}
            required
          />
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
