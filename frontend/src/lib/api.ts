import { useEffect, useRef, useState } from 'react'

// Falls back to whatever host the page itself was loaded from (with the backend's
// port) so this also works when a phone on the same WiFi opens the dev server by
// LAN IP — hardcoding "localhost" there would point the phone at itself.
export const API_BASE =
  import.meta.env.VITE_API_BASE ?? `${window.location.protocol}//${window.location.hostname}:5000`
const TOKEN_KEY = 'siteverify.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore storage failures (private browsing, etc.)
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
  const token = getToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
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
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/**
 * Fetches an authenticated binary resource (e.g. a delivery photo) and returns a
 * local blob: URL for it. Plain <img src="..."> can't send an Authorization
 * header, so protected images have to be loaded this way instead of by URL.
 * Caller owns the returned URL and must URL.revokeObjectURL it when done.
 */
export async function fetchAuthedImageUrl(path: string): Promise<string> {
  const token = getToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) throw new ApiError(res.status, `Could not load image (${res.status})`)
  return URL.createObjectURL(await res.blob())
}

/** POSTs a form and returns the binary reply (e.g. a converted photo) as a Blob. */
export async function postForBlob(path: string, body: FormData, signal?: AbortSignal): Promise<Blob> {
  const token = getToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body, headers, signal })
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`)
  return res.blob()
}


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

/**
 * Simple GET-and-cache-in-state hook. Refetches whenever `path` changes. If it fails for want of
 * the server (no signal, or the server restarting), it tries again by itself, sooner if the phone
 * comes back online, so a screen doesn't stay on "Failed to fetch".
 */
export function useApiGet<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const attempt = useRef(0)

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    let retry: number | undefined
    const tryAgain = () => setVersion((v) => v + 1)
    setLoading(true)

    api
      .get<T>(path)
      .then((result) => {
        if (cancelled) return
        attempt.current = 0
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
        if (isPassingFailure(err)) {
          retry = window.setTimeout(tryAgain, retryDelay(attempt.current++))
          window.addEventListener('online', tryAgain, { once: true })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(retry)
      window.removeEventListener('online', tryAgain)
    }
  }, [path, version])

  return { data, loading, error, refetch: () => setVersion((v) => v + 1) }
}
