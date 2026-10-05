import { useEffect, useState } from 'react'
import { api, getToken } from './api'

const POLL_MS = 60 * 1000

// One shared poll for the whole app: the nav badge and the header bell both
// read this, rather than each component hitting the server on its own.
let unread = 0
const listeners = new Set<(n: number) => void>()
let timer: number | undefined

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

function onVisible() {
  if (document.visibilityState === 'visible') refreshUnreadCount()
}

export function useUnreadCount() {
  const [count, setCount] = useState(unread)

  useEffect(() => {
    listeners.add(setCount)
    if (listeners.size === 1) {
      refreshUnreadCount()
      timer = window.setInterval(refreshUnreadCount, POLL_MS)
      document.addEventListener('visibilitychange', onVisible)
    }
    return () => {
      listeners.delete(setCount)
      if (listeners.size === 0) {
        window.clearInterval(timer)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [])

  return count
}
