import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, getToken, setToken } from './api'

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
  user: SessionUser | null
  login: (phone: string, password: string) => Promise<SessionUser>
  logout: () => void
}

const USER_KEY = 'siteverify.user'

function readStoredUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => (getToken() ? readStoredUser() : null))

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      login: async (phone: string, password: string) => {
        try {
          const res = await api.post<LoginResponse>('/api/auth/login', { phone, password })
          setToken(res.token)
          localStorage.setItem(USER_KEY, JSON.stringify(res.user))
          setUser(res.user)
          return res.user
        } catch (err) {
          throw err instanceof ApiError ? err : new Error('Could not reach the server')
        }
      },
      logout: () => {
        setToken(null)
        localStorage.removeItem(USER_KEY)
        setUser(null)
      },
    }),
    [user],
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
