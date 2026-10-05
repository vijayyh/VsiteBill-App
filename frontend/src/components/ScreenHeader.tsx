import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconBack } from './icons'

/** Back-button header for inner screens. Frosted and pinned to the top while the page scrolls. */
export function ScreenHeader({
  backTo,
  title,
  subtitle,
  action,
}: {
  backTo: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-10 flex-shrink-0 px-3 pt-3 pb-2">
      <div className="glass-strong rounded-[20px] flex items-center gap-2 px-1.5 h-14">
        <Link
          to={backTo}
          aria-label="Go back"
          className="w-10 h-10 rounded-full flex items-center justify-center text-ink hover:bg-white/60"
        >
          <IconBack size={20} />
        </Link>
        <div className="flex-grow min-w-0">
          <div className="text-[15.5px] font-bold leading-tight truncate">{title}</div>
          {subtitle && <div className="text-[11.5px] text-ink-muted truncate">{subtitle}</div>}
        </div>
        {action && <div className="flex-shrink-0 pr-1.5">{action}</div>}
      </div>
    </div>
  )
}
