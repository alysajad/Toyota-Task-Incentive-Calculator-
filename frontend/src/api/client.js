import axios from 'axios'

function resolveBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

  try {
    const url = new URL(configured)
    const browserHost = window.location.hostname
    const apiHostIsLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
    const browserHostIsLocal = browserHost === '127.0.0.1' || browserHost === 'localhost'

    if (apiHostIsLocal && !browserHostIsLocal) {
      url.hostname = browserHost
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    return configured
  }
}

const BASE_URL = resolveBaseUrl()

// --- Token store ----------------------------------------------------------
// NOTE on storage: the access token is held in memory; the refresh token is
// persisted in localStorage for a smooth reload experience. This trades some
// XSS exposure for simplicity (documented in the README). A production-grade
// alternative is an httpOnly refresh cookie — the interceptors below isolate
// that decision to one place.
const ACCESS_KEY = 'nt_access'
const REFRESH_KEY = 'nt_refresh'

let accessToken = sessionStorage.getItem(ACCESS_KEY) || null

export const tokenStore = {
  get access() {
    return accessToken
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set({ access, refresh }) {
    if (access !== undefined) {
      accessToken = access
      access ? sessionStorage.setItem(ACCESS_KEY, access) : sessionStorage.removeItem(ACCESS_KEY)
    }
    if (refresh !== undefined) {
      refresh ? localStorage.setItem(REFRESH_KEY, refresh) : localStorage.removeItem(REFRESH_KEY)
    }
  },
  clear() {
    accessToken = null
    sessionStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// --- Refresh-on-401 flow with request queueing ----------------------------
let refreshing = null
let onAuthFailure = () => {}
export function setAuthFailureHandler(fn) {
  onAuthFailure = fn
}

export async function refreshSession() {
  const refresh = tokenStore.refresh
  if (!refresh) throw new Error('no refresh token')
  const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh })
  tokenStore.set({ access: data.access, refresh: data.refresh ?? refresh })
  return data.access
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const isAuthBootstrapCall =
      original?.url?.includes('/auth/login/') ||
      original?.url?.includes('/auth/register/') ||
      original?.url?.includes('/auth/refresh/')

    if (status === 401 && original && !original._retry && !isAuthBootstrapCall && tokenStore.refresh) {
      original._retry = true
      try {
        refreshing = refreshing || refreshSession()
        const newAccess = await refreshing
        refreshing = null
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch (e) {
        refreshing = null
        tokenStore.clear()
        onAuthFailure()
        return Promise.reject(e)
      }
    }
    return Promise.reject(error)
  }
)

/** Normalise an axios error into a human string + field errors. */
export function parseError(error) {
  if (!error?.isAxiosError && !error?.response) {
    return { message: error?.message || 'Something went wrong.', errors: {} }
  }

  const data = error?.response?.data
  if (!data) {
    return { message: `Network error - is the API reachable at ${BASE_URL}?`, errors: {} }
  }
  const firstField = Object.keys(data.errors || {})[0]
  const firstError = firstField ? data.errors[firstField]?.[0] : null
  if (data.detail) {
    return {
      message: data.detail === 'Validation failed.' && firstError ? firstError : data.detail,
      errors: data.errors || {},
    }
  }
  return {
    message: firstError || 'Something went wrong.',
    errors: data.errors || {},
  }
}
