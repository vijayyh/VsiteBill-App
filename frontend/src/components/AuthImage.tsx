import { useEffect, useRef, useState } from 'react'
import { fetchAuthedImageUrl } from '../lib/api'

/**
 * Renders a delivery photo (or any protected upload) that requires a bearer token to fetch.
 * The photo is only downloaded once it's about to scroll into view, so opening a
 * gallery doesn't pull every bill's photo over mobile data up front.
 */
export function AuthImage({ src, alt = '', className }: { src: string; alt?: string; className?: string }) {
  const placeholderRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    const el = placeholderRef.current
    if (visible || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let created: string | null = null
    setBroken(false)

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
        // leave objectUrl null; callers render their own fallback around this component
      })

    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [src, visible])

  if (!objectUrl || broken) return <span ref={placeholderRef} className="block w-full h-full" />
  return <img src={objectUrl} alt={alt} className={className} onError={() => setBroken(true)} />
}
