import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/endpoints'
import { refreshSession, setAuthFailureHandler, tokenStore } from '../api/client'

const authContextKey = '__nipponToyotaAuthContext'
const AuthContext = globalThis[authContextKey] || createContext(null)
globalThis[authContextKey] = AuthContext

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  // If a refresh fails anywhere, drop the session.
  useEffect(() => {
    setAuthFailureHandler(() => setUser(null))
  }, [])

  // Bootstrap: if a refresh token survived a reload, restore the session.
  useEffect(() => {
    let active = true
    async function bootstrap() {
      if (!tokenStore.refresh) {
        tokenStore.clear()
        setLoading(false)
        return
      }
      try {
        await refreshSession()
        const me = await authApi.me()
        if (active) setUser(me)
      } catch {
        tokenStore.clear()
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials)
    tokenStore.set({ access: data.access, refresh: data.refresh })
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback((payload) => authApi.register(payload), [])

  const value = { user, loading, login, register, logout, setUser, isAuthed: !!user }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
