import { API_BASE } from './api'

// The opening splash lives in index.html, so its first frame paints before this code loads. This
// wakes the server straight away, plays the intro once the app has rendered underneath (while the
// phone is still busy starting the app, the animation would stall and jump), and decides when to
// hand over.
const INTRO_MS = 1900 // the intro's length plus a moment to read it
const WAIT_HINT_MS = 2400 // still waiting on the server this long after opening: say so
const MAX_MS = 5000 // don't hold the app back longer than this after opening (unless the intro is still playing)
const EXIT_MS = 520 // matches the sv-out animation in index.html
const NATIVE_FADE_MS = 520 // the Android app's native splash fade (twa-manifest.json) plus a margin
const RESUME_WAKE_AFTER_MS = 10 * 60 * 1000 // Render's free plan sleeps after 15 min idle

let lastWake = 0
let opened = 0 // when the first frame painted
let offline = false
let serverUp: Promise<boolean> = Promise.resolve(false)

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

/** Runs as soon as the app code loads: start waking the server. */
export function startSplash() {
  opened = (window as Window & { __svStart?: number }).__svStart ?? performance.now()
  offline = !navigator.onLine
  serverUp = offline ? Promise.resolve(false) : wakeServer()
}

function isInstalledApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  )
}

/** Runs once the app has rendered underneath: play the intro, then hand over. */
export function playSplash() {
  const splash = document.getElementById('sv-splash')
  if (!splash || splash.classList.contains('sv-play')) return // not shown this session, or already playing

  // In the installed Android app, let the native splash finish fading before anything moves.
  const sinceOpened = performance.now() - opened
  const hold = isInstalledApp() ? Math.max(0, NATIVE_FADE_MS - sinceOpened) : 0
  splash.style.setProperty('--sv-delay', `${Math.round(hold)}ms`)
  if (offline) {
    splash.classList.add('sv-offline')
    const text = splash.querySelector('.sv-status-text')
    if (text) text.textContent = 'No signal — you can still add bills'
  }
  splash.classList.add('sv-play')

  const introStart = performance.now() + hold
  const until = (time: number) => Math.max(0, time - performance.now())
  // Offline: leave the "No signal" note up long enough to read.
  const earliestExit = introStart + INTRO_MS + (offline ? 900 : 0)
  const hint = window.setTimeout(
    () => splash.classList.add('sv-wait'),
    until(Math.max(opened + WAIT_HINT_MS, introStart + 1200)),
  )

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    window.clearTimeout(hint)
    window.clearTimeout(cap)
    window.setTimeout(() => {
      splash.classList.add('sv-exit')
      window.setTimeout(() => splash.remove(), EXIT_MS)
    }, until(earliestExit))
  }
  const cap = window.setTimeout(finish, until(Math.max(opened + MAX_MS, earliestExit)))
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
