import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [menuStyle, setMenuStyle] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current || typeof window === 'undefined') return

    const gutter = 12
    const rect = buttonRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const compact = viewportWidth < 640
    const width = compact ? viewportWidth - gutter * 2 : Math.min(256, viewportWidth - gutter * 2)

    let left
    if (compact) {
      left = gutter
    } else if (align === 'right') {
      left = rect.right - width
      if (left < gutter) left = rect.left
    } else {
      left = rect.left
      if (left + width > viewportWidth - gutter) left = rect.right - width
    }
    left = Math.min(Math.max(left, gutter), viewportWidth - width - gutter)

    const menuHeight = menuRef.current?.offsetHeight || 132
    const belowTop = rect.bottom + 8
    const aboveTop = rect.top - menuHeight - 8
    const top =
      belowTop + menuHeight > viewportHeight - gutter && aboveTop >= gutter
        ? aboveTop
        : Math.min(belowTop, viewportHeight - gutter - Math.min(menuHeight, viewportHeight - gutter * 2))

    setMenuStyle({
      left,
      top: Math.max(top, gutter),
      width,
      maxHeight: Math.max(132, viewportHeight - Math.max(top, gutter) - gutter),
    })
  }, [align])

  useEffect(() => {
    function onClick(e) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined

    updateMenuPosition()
    const raf = requestAnimationFrame(updateMenuPosition)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

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

  const menu = (
    <AnimatePresence>
      {open && menuStyle && (
        <motion.div
          ref={menuRef}
          role="menu"
          aria-label={`${label} options`}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.12 }}
          className="fixed z-50 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-float"
          style={menuStyle}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run('summary')}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toyota/30"
          >
            <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-toyota" />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-950">By month</span>
              <span className="block text-xs leading-5 text-slate-500">One row per saved month with tier &amp; payout</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run('lines')}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toyota/30"
          >
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-toyota" />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-950">By car model</span>
              <span className="block text-xs leading-5 text-slate-500">Per-model breakdown across every month</span>
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className="inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
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

      {typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  )
}
