import type { ReactNode } from 'react'
import { useGoBack } from '../lib/goBack'
import { IconBack } from './icons'

/**
 * Back-button header for inner screens. Frosted and pinned to the top while the page scrolls, with
 * anything passed as children (a screen's tabs) pinned under it.
 */
export function ScreenHeader({
  backTo,
  title,
  subtitle,
  action,
  children,
}: {
  backTo: string
  title: string
  subtitle?: string
  action?: ReactNode
  children?: ReactNode
}) {
  const goBack = useGoBack(backTo)
  return (
    <div className="sticky top-0 z-10 flex-shrink-0 px-3 pt-3 pb-2">
      <div className="glass-strong rounded-[20px] flex items-center gap-2 px-1.5 h-14">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="w-10 h-10 rounded-full flex items-center justify-center text-ink hover:bg-white/60"
        >
          <IconBack size={20} />
        </button>
        <div className="flex-grow min-w-0">
          <div className="text-[15.5px] font-bold leading-tight truncate">{title}</div>
          {subtitle && <div className="text-[11.5px] text-ink-muted truncate">{subtitle}</div>}
        </div>
        {action && <div className="flex-shrink-0 pr-1.5">{action}</div>}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
