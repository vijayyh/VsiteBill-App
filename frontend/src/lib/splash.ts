import { API_BASE } from './api'

// The opening splash lives in index.html (so its first frame paints before this code loads).
// This plays it and decides when to hand over to the app.
const SEEN_KEY = 'sv-splash-seen'
const MIN_MS = 1900 // long enough for the intro to finish and read
const WAIT_HINT_MS = 2400 // still waiting on the server by now: say so
const MAX_MS = 5000 // never hold the app back longer than this
const EXIT_MS = 520 // matches the sv-out animation in index.html
// In the installed apps the native splash is still fading out when this starts, so hold the
// (identical) first frame briefly before moving.
const INSTALLED_DELAY_MS = 380
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

function isInstalledApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  )
}

export function runSplash() {
  const offline = !navigator.onLine
  const serverUp = offline ? Promise.resolve(false) : wakeServer()

  const splash = document.getElementById('sv-splash')
  if (!splash) return // already shown this session
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Private mode etc.: the splash just shows again on reload.
  }

  splash.style.setProperty('--sv-delay', `${isInstalledApp() ? INSTALLED_DELAY_MS : 0}ms`)
  if (offline) {
    splash.classList.add('sv-offline')
    const text = splash.querySelector('.sv-status-text')
    if (text) text.textContent = 'No signal — you can still add bills'
  }
  splash.classList.add('sv-play')

  const started = performance.now()
  const hint = window.setTimeout(() => splash.classList.add('sv-wait'), WAIT_HINT_MS)
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    window.clearTimeout(hint)
    window.clearTimeout(cap)
    // Offline: leave the "No signal" note up long enough to read.
    const minimum = MIN_MS + (offline ? 900 : 0)
    window.setTimeout(() => {
      splash.classList.add('sv-exit')
      window.setTimeout(() => splash.remove(), EXIT_MS)
    }, Math.max(0, minimum - (performance.now() - started)))
  }
  const cap = window.setTimeout(finish, MAX_MS)
  // Ready as soon as the server answers, or straight away when there's nothing to wait for.
  serverUp.then(finish)
}

/** Coming back to the app after a long break: wake the server again before the user needs it. */
export function wakeOnResume() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastWake > RESUME_WAKE_AFTER_MS) {
      void wakeServer()
    }
  })
}
