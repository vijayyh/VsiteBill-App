import { useEffect, useState } from 'react'
import { fetchAuthedImageUrl } from '../lib/api'

/** Renders a delivery photo (or any protected upload) that requires a bearer token to fetch. */
export function AuthImage({ src, alt = '', className }: { src: string; alt?: string; className?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
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
        // leave objectUrl null; callers render their own fallback around this component
      })

    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [src])

  if (!objectUrl) return null
  return <img src={objectUrl} alt={alt} className={className} />
}
