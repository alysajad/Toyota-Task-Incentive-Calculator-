import { api } from './client'

export const authApi = {
  login: (payload) => api.post('/auth/login/', payload).then((r) => r.data),
  register: (payload) => api.post('/auth/register/', payload).then((r) => r.data),
  me: () => api.get('/auth/me/').then((r) => r.data),
}

export const carsApi = {
  list: (params) => api.get('/cars/', { params }).then((r) => r.data),
  create: (payload) => api.post('/cars/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/cars/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/cars/${id}/`).then((r) => r.data),
}

export const slabsApi = {
  list: () => api.get('/slabs/').then((r) => r.data),
  create: (payload) => api.post('/slabs/', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/slabs/${id}/`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/slabs/${id}/`).then((r) => r.data),
  validate: (slabs) => api.post('/slabs/validate/', { slabs }).then((r) => r.data),
  bulkReplace: (slabs) => api.put('/slabs/bulk-replace/', { slabs }).then((r) => r.data),
}

export const officersApi = {
  list: (params) => api.get('/officers/', { params }).then((r) => r.data),
  approve: (id) => api.post(`/officers/${id}/approve/`).then((r) => r.data),
  reject: (id) => api.post(`/officers/${id}/reject/`).then((r) => r.data),
}

export const salesApi = {
  list: (params) => api.get('/sales/', { params }).then((r) => r.data),
  get: (month, year) => api.get(`/sales/${month}/${year}/`).then((r) => r.data),
  save: (payload) => api.post('/sales/', payload).then((r) => r.data),
  calculate: (payload) => api.post('/calculate/', payload).then((r) => r.data),
}

export const analyticsApi = {
  admin: () => api.get('/analytics/admin/').then((r) => r.data),
  officer: () => api.get('/analytics/officer/').then((r) => r.data),
}

/** Unwrap a paginated DRF response or return the array as-is. */
export const asList = (data) => (Array.isArray(data) ? data : data?.results ?? [])
