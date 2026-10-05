import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GRADIENT } from '../lib/projectColors'
import type { ProjectAccent } from '../lib/types'

/** A white-on-colour site skyline, standing in for a project photo. */
export function Skyline() {
  return (
    <svg viewBox="0 0 200 80" className="absolute right-0 bottom-0 h-[78%] opacity-25" fill="white" aria-hidden>
      <rect x="10" y="38" width="22" height="42" />
      <rect x="36" y="22" width="26" height="58" />
      <rect x="66" y="46" width="18" height="34" />
      <rect x="88" y="12" width="30" height="68" />
      <rect x="122" y="30" width="20" height="50" />
      <rect x="146" y="40" width="26" height="40" />
      <path d="M150 40 L150 4 L196 4 L196 8 L154 8 L154 40 Z" />
      <rect x="186" y="8" width="2" height="16" />
      <rect x="182" y="24" width="10" height="7" />
    </svg>
  )
}

/** Colour "hero" card for a project, in place of the design's building photos. */
export function ProjectCard({
  to,
  code,
  name,
  accent,
  footer,
  className = '',
}: {
  to: string
  code: string
  name: string
  accent: ProjectAccent
  footer?: ReactNode
  className?: string
}) {
  return (
    <Link to={to} className={`block glass rounded-card overflow-hidden ${className}`}>
      <div className={`relative h-[104px] m-1.5 mb-0 rounded-[14px] overflow-hidden bg-gradient-to-br ${GRADIENT[accent]} px-4 py-3.5 text-white`}>
        <Skyline />
        <div className="relative text-[11px] font-semibold opacity-80 tracking-wide">{code}</div>
        <div className="relative text-[16px] font-bold leading-snug mt-0.5 pr-16 line-clamp-2">{name}</div>
      </div>
      {footer && <div className="px-4 py-3">{footer}</div>}
    </Link>
  )
}
