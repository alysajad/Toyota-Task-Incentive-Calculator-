export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inrPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(value, { paise = false } = {}) {
  const num = Number(value ?? 0)
  if (Number.isNaN(num)) return '₹0'
  return (paise ? inrPaise : inr).format(num)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value ?? 0))
}

export function monthLabel(month, year) {
  return `${MONTHS[(month || 1) - 1]} ${year || ''}`.trim()
}

export function initials(user) {
  if (!user) return '?'
  const f = (user.first_name || '').trim()
  const l = (user.last_name || '').trim()
  if (f || l) return `${f[0] || ''}${l[0] || ''}`.toUpperCase()
  return (user.email || '?')[0].toUpperCase()
}

export function fullName(user) {
  if (!user) return ''
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return name || user.email
}
