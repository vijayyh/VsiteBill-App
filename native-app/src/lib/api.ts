import { useFocusEffect } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useCallback, useEffect, useRef, useState } from 'react'

// Same API client as the web app (frontend/src/lib/api.ts). Differences: the token lives in the
// phone's encrypted secure storage instead of localStorage, and the server address is fixed at
// build time (EXPO_PUBLIC_API_BASE; the live API when it isn't set).
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://vsitebill-api.onrender.com'
const TOKEN_KEY = 'siteverify.token'

// Kept in memory so every request doesn't have to read secure storage; loaded once at start-up.
let token: string | null = null

export async function loadToken() {
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    token = null
  }
  return token
}

export function getToken() {
  return token
}

export async function setToken(value: string | null) {
  token = value
  try {
    if (value) await SecureStore.setItemAsync(TOKEN_KEY, value)
    else await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    // The in-memory token still works for this session.
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    // No connection: the same message the web app shows (Chrome's), not the Java exception text.
    throw new TypeError('Failed to fetch')
  }
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : null

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Source for a protected photo (e.g. /uploads/…): the image loader sends the token as a header. */
export function authedImageSource(path: string) {
  return { uri: `${API_BASE}${path}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined }
}

/**
 * GET-and-keep-in-state hook, as on the web. It also refetches whenever the screen comes back into
 * view (the web remounts screens on every visit; native keeps them alive), and offers a
 * pull-to-refresh state, since there's no browser reload button in an app.
 */
/**
 * A failure worth trying again by itself: no connection, or the server restarting or waking up
 * (Render answers 502/503/504 meanwhile, which a browser reports as "Failed to fetch").
 */
export function isPassingFailure(err: unknown): boolean {
  return !(err instanceof ApiError) || [502, 503, 504].includes(err.status)
}

/** Waits before the next automatic retry: 3 s, 6 s, 12 s… up to 30 s. */
export function retryDelay(attempt: number): number {
  return Math.min(30_000, 3_000 * 2 ** attempt)
}

// Same as the web's hook: a fetch that fails for want of the server is tried again by itself.
export function useApiGet<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)
  const attempt = useRef(0)
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [retries, setRetries] = useState(0)

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (path === null) return
      const call = ++latest.current
      clearTimeout(retry.current)
      if (mode === 'initial') setLoading(true)
      if (mode === 'refresh') setRefreshing(true)
      try {
        const result = await api.get<T>(path)
        if (call === latest.current) {
          attempt.current = 0
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (call === latest.current) {
          setError(err instanceof Error ? err.message : 'Something went wrong')
          if (isPassingFailure(err)) {
            retry.current = setTimeout(() => setRetries((n) => n + 1), retryDelay(attempt.current++))
          }
        }
      } finally {
        if (call === latest.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [path],
  )

  useEffect(() => () => clearTimeout(retry.current), [])
  useEffect(() => {
    // A retry after a failed fetch (see the catch above): reload quietly, keeping what's shown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (retries > 0) void load('silent')
  }, [retries, load])

  useEffect(() => {
    // Showing "loading" as a fetch starts is the point here (the web's hook does the same).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (path !== null) void load('initial')
  }, [path, load])

  // Coming back to a screen (e.g. after reviewing a bill): refresh quietly, keeping what's shown.
  const firstFocus = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false
        return
      }
      void load('silent')
    }, [load]),
  )

  return {
    data,
    // Nothing to fetch (no path yet) is never "loading".
    loading: path !== null && loading,
    error,
    refreshing,
    refetch: () => void load('silent'),
    refresh: () => void load('refresh'),
  }
}
