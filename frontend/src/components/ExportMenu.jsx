import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, FileSpreadsheet, Layers, Loader2 } from 'lucide-react'

import { exportApi, downloadResponse } from '../api/endpoints'
import { useToast } from './Toast'
import { cn } from './ui'

/**
 * One-click CSV export, available to every role. Offers two grains:
 *   • Summary  — one row per saved month
 *   • Detailed — one row per car model
 *
 * `params` are passed straight to the export endpoint (e.g. { officer: id }).
 * Server-side RBAC scopes the data, so officers only ever get their own rows.
 */
export function ExportMenu({ params = {}, label = 'Export CSV', size = 'sm', align = 'right' }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const run = async (detail) => {
    setOpen(false)
    setBusy(true)
    try {
      const response = await exportApi.sales({ ...params, detail })
      const name = downloadResponse(response)
      toast.success(`Exported ${name}`)
    } catch {
      toast.error('Could not export data. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const sizes = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 shadow-sm',
          'transition-colors duration-200 cursor-pointer hover:border-toyota/40 hover:bg-toyota-50 hover:text-toyota-800',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-toyota/20 disabled:pointer-events-none disabled:opacity-50',
          sizes[size],
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'absolute z-30 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-float',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            <button
              onClick={() => run('summary')}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-toyota" />
              <span>
                <span className="block text-sm font-bold text-slate-950">By month</span>
                <span className="block text-xs text-slate-500">One row per saved month with tier &amp; payout</span>
              </span>
            </button>
            <button
              onClick={() => run('lines')}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
              <Layers className="mt-0.5 h-4 w-4 shrink-0 text-toyota" />
              <span>
                <span className="block text-sm font-bold text-slate-950">By car model</span>
                <span className="block text-xs text-slate-500">Per-model breakdown across every month</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
