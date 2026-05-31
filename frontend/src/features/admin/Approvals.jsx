import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UserCheck, Check, X, Mail, BadgeCheck } from 'lucide-react'

import { officersApi, asList } from '../../api/endpoints'
import { parseError } from '../../api/client'
import { Button, Card, Skeleton, EmptyState, StatusBadge } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { fullName, initials } from '../../lib/format'

const FILTERS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: '', label: 'All' },
]

export default function Approvals() {
  const toast = useToast()
  const [filter, setFilter] = useState('PENDING')
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [counts, setCounts] = useState({ PENDING: 0 })

  const load = async (status = filter) => {
    setLoading(true)
    try {
      const data = asList(await officersApi.list(status ? { status } : {}))
      setOfficers(data)
      if (status === 'PENDING') setCounts((c) => ({ ...c, PENDING: data.length }))
    } catch (err) {
      toast.error(parseError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const act = async (officer, kind) => {
    setBusyId(officer.id)
    // Optimistic: drop from the pending view immediately.
    const prev = officers
    if (filter === 'PENDING') {
      setOfficers((os) => os.filter((o) => o.id !== officer.id))
      setCounts((c) => ({ ...c, PENDING: Math.max(0, c.PENDING - 1) }))
    }
    try {
      if (kind === 'approve') {
        await officersApi.approve(officer.id)
        toast.success(`${fullName(officer)} approved — they can now sign in.`)
      } else {
        await officersApi.reject(officer.id)
        toast.info(`${fullName(officer)} rejected.`)
      }
      if (filter !== 'PENDING') load(filter)
    } catch (err) {
      setOfficers(prev) // rollback
      toast.error(parseError(err).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === f.key
                ? 'bg-ink text-white'
                : 'bg-surface text-muted ring-1 ring-line hover:bg-surface-soft'
            }`}
          >
            {f.label}
            {f.key === 'PENDING' && counts.PENDING > 0 && (
              <span className="ml-1.5 rounded-full bg-toyota px-1.5 text-xs text-white nums">
                {counts.PENDING}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : officers.length === 0 ? (
        <EmptyState
          icon={filter === 'PENDING' ? BadgeCheck : UserCheck}
          title={filter === 'PENDING' ? 'No pending signups' : 'Nothing here'}
          description={
            filter === 'PENDING'
              ? 'Every sales officer has been reviewed. New signups will appear here.'
              : 'No officers match this filter.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {officers.map((o) => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              >
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink font-display text-sm font-bold text-white">
                      {initials(o)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate font-semibold text-content">{fullName(o)}</h3>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{o.email}</span>
                      </div>
                      {o.employee_code && (
                        <div className="mt-0.5 font-mono text-xs text-muted nums">
                          {o.employee_code}
                        </div>
                      )}
                    </div>
                  </div>

                  {o.status === 'PENDING' && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        loading={busyId === o.id}
                        onClick={() => act(o, 'approve')}
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="flex-1"
                        disabled={busyId === o.id}
                        onClick={() => act(o, 'reject')}
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
