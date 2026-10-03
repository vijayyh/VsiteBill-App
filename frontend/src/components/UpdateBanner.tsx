import { useEffect, useState } from 'react'

const CHECK_EVERY_MS = 30 * 60 * 1000

/**
 * The service worker (vite-plugin-pwa, autoUpdate) installs a new version in the
 * background and takes over immediately, but the page that's already open keeps
 * running the old code. When that takeover happens, offer a reload instead of
 * forcing one — a supervisor may be halfway through filling in a bill.
 */
export function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const sw = navigator.serviceWorker

    // The very first install also fires controllerchange; only a *replacement*
    // of an existing controller means a new version arrived.
    let hadController = !!sw.controller
    const onControllerChange = () => {
      if (hadController) setUpdateReady(true)
      hadController = true
    }
    sw.addEventListener('controllerchange', onControllerChange)

    // Browsers only look for a new service worker on navigation, which a
    // single-page app left open for days never does — so ask periodically and
    // whenever the app comes back to the foreground.
    const checkForUpdate = () => {
      sw.getRegistration().then((reg) => reg?.update()).catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(checkForUpdate, CHECK_EVERY_MS)

    return () => {
      sw.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [])

  if (!updateReady || dismissed) return null

  return (
    <div role="status" className="flex-shrink-0 flex items-center gap-2.5 bg-accent text-white px-4 py-2.5">
      <div className="flex-grow text-[12.5px] font-semibold leading-snug">A new version of SiteVerify is ready.</div>
      <button
        onClick={() => window.location.reload()}
        className="flex-shrink-0 text-[12px] font-bold bg-white text-accent rounded-btn px-3 py-1.5"
      >
        Update
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white/80 text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}
