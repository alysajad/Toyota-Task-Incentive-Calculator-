import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Car, Plus, Pencil, Trash2, Power } from 'lucide-react'

import { carsApi, asList } from '../../api/endpoints'
import { parseError } from '../../api/client'
import { Button, Card, Field, Input, IconButton, Skeleton, EmptyState, Badge } from '../../components/ui'
import { Modal, ConfirmDialog } from '../../components/Modal'
import { useToast } from '../../components/Toast'

const EMPTY = { model_name: '', variant: '', base_suffix: '', is_active: true }

export default function CarInventory() {
  const toast = useToast()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await carsApi.list()
      setCars(asList(data))
    } catch (err) {
      setLoadError(parseError(err).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setErrors({})
    setModalOpen(true)
  }
  const openEdit = (car) => {
    setEditing(car)
    setForm({
      model_name: car.model_name,
      variant: car.variant,
      base_suffix: car.base_suffix,
      is_active: car.is_active,
    })
    setErrors({})
    setModalOpen(true)
  }

  const onSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      if (editing) {
        await carsApi.update(editing.id, form)
        toast.success('Car model updated.')
      } else {
        await carsApi.create(form)
        toast.success('Car model added.')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      const parsed = parseError(err)
      setErrors(parsed.errors)
      if (Object.keys(parsed.errors).length === 0) toast.error(parsed.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (car) => {
    try {
      await carsApi.update(car.id, { is_active: !car.is_active })
      setCars((cs) => cs.map((c) => (c.id === car.id ? { ...c, is_active: !c.is_active } : c)))
    } catch (err) {
      toast.error(parseError(err).message)
    }
  }

  const onDelete = async () => {
    setDeleteLoading(true)
    try {
      await carsApi.remove(deleting.id)
      toast.success('Car model removed.')
      setDeleting(null)
      load()
    } catch (err) {
      toast.error(parseError(err).message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const fieldErr = (k) => errors[k]?.[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-400">
          The catalogue your officers log sales against. Toggle a model off to retire it.
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          Add model
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="p-6">
            <EmptyState
              icon={Car}
              title="Couldn't load inventory"
              description={loadError}
              action={<Button onClick={load} variant="outline" size="sm">Retry</Button>}
            />
          </div>
        ) : cars.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Car}
              title="No car models yet"
              description="Add your first Toyota model to start building the catalogue."
              action={<Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" />Add model</Button>}
            />
          </div>
        ) : (
          <div className="divide-y divide-sand-200">
            {/* header row (desktop) */}
            <div className="hidden grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400 sm:grid">
              <span>Model</span>
              <span>Variant · Suffix</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            {cars.map((car, i) => (
              <motion.div
                key={car.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sand-100 text-ink">
                    <Car className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-ink">{car.model_name}</span>
                </div>
                <div className="hidden text-sm text-ink-400 sm:block">
                  {car.variant || '—'}
                  {car.base_suffix && <span className="text-ink-400/60"> · {car.base_suffix}</span>}
                </div>
                <div className="hidden sm:block">
                  <Badge tone={car.is_active ? 'green' : 'neutral'}>
                    {car.is_active ? 'Active' : 'Retired'}
                  </Badge>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <IconButton onClick={() => toggleActive(car)} aria-label="Toggle active" title={car.is_active ? 'Retire' : 'Reactivate'}>
                    <Power className={`h-4 w-4 ${car.is_active ? 'text-emerald-500' : 'text-ink-400'}`} />
                  </IconButton>
                  <IconButton onClick={() => openEdit(car)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton onClick={() => setDeleting(car)} aria-label="Delete" className="hover:bg-toyota-50 hover:text-toyota">
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit car model' : 'Add car model'}
        description="Used as a line item in officers' monthly sales."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={saving}>
              {editing ? 'Save changes' : 'Add model'}
            </Button>
          </>
        }
      >
        <form onSubmit={onSave} className="space-y-4">
          <Field label="Model name" required error={fieldErr('model_name')}>
            <Input
              value={form.model_name}
              onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
              placeholder="Toyota Innova Crysta"
              invalid={!!fieldErr('model_name')}
              autoFocus
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Variant" error={fieldErr('variant')}>
              <Input
                value={form.variant}
                onChange={(e) => setForm((f) => ({ ...f, variant: e.target.value }))}
                placeholder="ZX AT"
              />
            </Field>
            <Field label="Base suffix" error={fieldErr('base_suffix')}>
              <Input
                value={form.base_suffix}
                onChange={(e) => setForm((f) => ({ ...f, base_suffix: e.target.value }))}
                placeholder="INV"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 rounded-xl border border-sand-200 bg-sand-50 px-3.5 py-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-sand-300 text-toyota focus:ring-toyota"
            />
            <span className="text-sm font-medium text-ink">Active — available for sales logging</span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
        danger
        title="Remove car model?"
        confirmLabel="Remove"
        message={`"${deleting?.model_name}" will be removed from the catalogue. Existing sales records that reference it are protected and won't be deleted.`}
      />
    </div>
  )
}
