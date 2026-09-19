import { useEffect, useState } from 'react'
import { fetchAuthedImageUrl } from '../lib/api'
import { IconClose } from './icons'

/** Full-screen lightbox for a protected delivery photo. Renders nothing when `src` is null. */
export function PhotoViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!src) {
      setObjectUrl(null)
      setFailed(false)
      return
    }
    let cancelled = false
    let created: string | null = null

    fetchAuthedImageUrl(src)
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
  }, [src])

  if (!src) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex-shrink-0 flex justify-end p-4">
        <button
          onClick={onClose}
          aria-label="Close photo"
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <IconClose size={18} stroke="#FFFFFF" />
        </button>
      </div>
      <div className="flex-grow flex items-center justify-center px-4 pb-8 overflow-hidden">
        {objectUrl && <img src={objectUrl} alt="Delivery challan" className="max-w-full max-h-full object-contain" />}
        {failed && <div className="text-white/70 text-sm">Could not load this photo.</div>}
        {!objectUrl && !failed && <div className="text-white/70 text-sm">Loading…</div>}
      </div>
    </div>
  )
}
