import { useEffect, useRef, useState } from 'react'
import { fetchAuthedImageUrl } from '../lib/api'
import { IconChevronRight, IconClose } from './icons'

/** "3 pages" on a bill's thumbnail (inside a `relative` box), for a bill of more than one page. */
export function PagesBadge({ count }: { count: number }) {
  if (count < 2) return null
  return (
    <span className="absolute bottom-1 right-1 rounded-full bg-black/55 text-white text-[10px] font-bold leading-none px-1.5 py-[3px]">
      {count} pages
    </span>
  )
}

// When the viewer closes, its history entry is stepped back over a moment later: in development
// React mounts it twice in a row, and the second mount keeps the entry instead.
let pendingHistoryBack: number | undefined

/**
 * Full-screen lightbox for a protected delivery photo, or for every page of a bill (an array, in
 * page order). Renders nothing when `src` is null. While it's open, the phone's back button (and
 * the browser's) closes it, as on the native app, instead of leaving the screen behind it.
 */
export function PhotoViewer({ src, onClose }: { src: string | string[] | null; onClose: () => void }) {
  const pages = src === null ? [] : Array.isArray(src) ? src : [src]
  const open = pages.length > 0
  // The page shown, for this set of pages (a new set starts at page 1).
  const pagesKey = pages.join('|')
  const [shown, setShown] = useState({ key: '', index: 0 })
  const index = shown.key === pagesKey ? Math.min(shown.index, pages.length - 1) : 0
  const page = open ? pages[index] : null

  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!page) {
      setObjectUrl(null)
      setFailed(false)
      return
    }
    let cancelled = false
    let created: string | null = null
    setObjectUrl(null)
    setFailed(false)

    fetchAuthedImageUrl(page)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        created = url
        setObjectUrl(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [page])

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    if (pendingHistoryBack !== undefined) {
      window.clearTimeout(pendingHistoryBack)
      pendingHistoryBack = undefined
    } else {
      window.history.pushState({ ...window.history.state, photoViewer: true }, '')
    }
    const onBack = () => onCloseRef.current()
    window.addEventListener('popstate', onBack)
    return () => {
      window.removeEventListener('popstate', onBack)
      // Closed with the × (not with back): step back over the viewer's own entry.
      pendingHistoryBack = window.setTimeout(() => {
        pendingHistoryBack = undefined
        if (window.history.state?.photoViewer) window.history.back()
      })
    }
  }, [open])

  if (!open) return null

  const go = (step: number) => setShown({ key: pagesKey, index: index + step })

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between p-4">
        <div className="text-white/80 text-[13px] font-semibold pl-1" aria-live="polite">
          {pages.length > 1 ? `Page ${index + 1} of ${pages.length}` : ''}
        </div>
        <button
          onClick={onClose}
          aria-label="Close photo"
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <IconClose size={18} stroke="#FFFFFF" />
        </button>
      </div>
      <div className="flex-grow flex items-center justify-center px-4 pb-8 overflow-hidden">
        {objectUrl && <img src={objectUrl} alt={`Bill page ${index + 1}`} className="max-w-full max-h-full object-contain" />}
        {failed && <div className="text-white/70 text-sm">Could not load this photo.</div>}
        {!objectUrl && !failed && <div className="text-white/70 text-sm">Loading…</div>}
      </div>
      {pages.length > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-6 pb-[calc(1.5rem+var(--safe-bottom))]">
          <button
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Previous page"
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"
          >
            <span className="rotate-180">
              <IconChevronRight size={20} stroke="#FFFFFF" />
            </span>
          </button>
          <button
            onClick={() => go(1)}
            disabled={index === pages.length - 1}
            aria-label="Next page"
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"
          >
            <IconChevronRight size={20} stroke="#FFFFFF" />
          </button>
        </div>
      )}
    </div>
  )
}
