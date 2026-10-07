import { useEffect, useState } from 'react'
import { AppState, type NativeEventSubscription } from 'react-native'
import { api, getToken } from './api'

const POLL_MS = 60 * 1000

// One shared poll for the whole app: the nav badge and the header bell both
// read this, rather than each component hitting the server on its own.
// (Same as frontend/src/lib/notifications.ts; "app came to the foreground" replaces visibilitychange.)
let unread = 0
const listeners = new Set<(n: number) => void>()
let timer: ReturnType<typeof setInterval> | undefined
let appState: NativeEventSubscription | undefined

export function refreshUnreadCount() {
  if (!getToken()) return
  api
    .get<{ count: number }>('/api/notifications/unread-count')
    .then((res) => {
      unread = res.count
      listeners.forEach((listener) => listener(unread))
    })
    .catch(() => {})
}

export function useUnreadCount() {
  const [count, setCount] = useState(unread)

  useEffect(() => {
    listeners.add(setCount)
    if (listeners.size === 1) {
      refreshUnreadCount()
      timer = setInterval(refreshUnreadCount, POLL_MS)
      appState = AppState.addEventListener('change', (next) => {
        if (next === 'active') refreshUnreadCount()
      })
    }
    return () => {
      listeners.delete(setCount)
      if (listeners.size === 0) {
        clearInterval(timer)
        appState?.remove()
      }
    }
  }, [])

  return count
}
