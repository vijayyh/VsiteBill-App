import { Link } from 'react-router-dom'
import { IconBack } from './icons'

export function ScreenHeader({
  backTo,
  title,
  subtitle,
}: {
  backTo: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex-shrink-0 flex items-center gap-2.5 px-2 h-14 bg-surface border-b border-border">
      <Link
        to={backTo}
        aria-label="Go back"
        className="w-10 h-10 flex items-center justify-center text-ink"
      >
        <IconBack />
      </Link>
      <div>
        <div className="text-[15.5px] font-bold leading-tight">{title}</div>
        {subtitle && <div className="text-[11.5px] text-ink-muted">{subtitle}</div>}
      </div>
    </div>
  )
}
