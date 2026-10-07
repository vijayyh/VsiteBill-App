import { AppState } from 'react-native'
import { API_BASE } from './api'

// Same rules as the web app's opening splash (frontend/src/lib/splash.ts).
export const INTRO_MS = 1900 // the intro's length plus a moment to read it
export const WAIT_HINT_MS = 2400 // still waiting on the server this long after opening: say so
export const MAX_MS = 5000 // don't hold the app back longer than this after opening
export const OFFLINE_EXTRA_MS = 900 // offline: leave the "No signal" note up long enough to read
const RESUME_WAKE_AFTER_MS = 10 * 60 * 1000 // Render's free plan sleeps after 15 min idle

let lastWake = 0

/**
 * Pings the API so a sleeping server (Render free plan, ~30-60 s to start) begins booting right away
 * instead of on the user's first real request. Resolves true once it answers.
 */
export function wakeServer(timeoutMs = 60_000): Promise<boolean> {
  lastWake = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(`${API_BASE}/api/health`, { cache: 'no-store', signal: controller.signal })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => clearTimeout(timer))
}

/** Coming back to the app after a long break: wake the server again before the user needs it. */
export function wakeOnResume() {
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active' && Date.now() - lastWake > RESUME_WAKE_AFTER_MS) void wakeServer()
  })
  return () => sub.remove()
}
