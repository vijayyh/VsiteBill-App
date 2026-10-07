import * as SecureStore from 'expo-secure-store'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, loadToken, setToken } from './api'

// Same session logic as the web app (frontend/src/lib/session.tsx), stored in secure storage.
export type Role = 'supervisor' | 'accountant' | 'admin'

export interface SessionUser {
  id: number
  name: string
  initials: string
  role: Role
}

interface LoginResponse {
  token: string
  user: SessionUser
}

interface SessionContextValue {
  /** False until the saved login has been read from storage at start-up. */
  ready: boolean
  user: SessionUser | null
  login: (phone: string, password: string) => Promise<SessionUser>
  logout: () => void
}

const USER_KEY = 'siteverify.user'

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const token = await loadToken()
        const raw = token ? await SecureStore.getItemAsync(USER_KEY) : null
        setUser(raw ? (JSON.parse(raw) as SessionUser) : null)
      } catch {
        setUser(null)
      } finally {
        setReady(true)
      }
    })()
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      ready,
      user,
      login: async (phone: string, password: string) => {
        try {
          const res = await api.post<LoginResponse>('/api/auth/login', { phone, password })
          await setToken(res.token)
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user)).catch(() => {})
          setUser(res.user)
          return res.user
        } catch (err) {
          throw err instanceof ApiError ? err : new Error('Could not reach the server')
        }
      },
      logout: () => {
        void setToken(null)
        void SecureStore.deleteItemAsync(USER_KEY).catch(() => {})
        setUser(null)
      },
    }),
    [ready, user],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}

// Admin deliberately has no quick-demo button on the login screen — it's a
// privileged role, so those credentials are handed out directly rather than
// invited with a one-tap button like the two operational roles.
export const DEMO_CREDENTIALS: Record<'supervisor' | 'accountant', { phone: string; password: string }> = {
  supervisor: { phone: '+91 98200 00001', password: 'demo1234' },
  accountant: { phone: '+91 98200 00002', password: 'demo1234' },
}
