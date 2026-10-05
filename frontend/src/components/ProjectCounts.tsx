import { STATUS_META } from '../lib/status'
import type { ProjectSummary } from '../lib/types'

function Chip({ label, className }: { label: string; className: string }) {
  return <span className={`text-[10.5px] font-bold rounded-full px-2 py-[3px] whitespace-nowrap ring-1 ring-white/70 ${className}`}>{label}</span>
}

/** "2 pending · 3 flagged" chips for a project, or "All matched" / "No bills yet". */
export function ProjectCounts({ project }: { project: ProjectSummary }) {
  const { pendingCount, flaggedCount, matchedCount } = project
  const pending = STATUS_META.PENDING
  const flagged = STATUS_META.REVIEW
  const matched = STATUS_META.MATCHED

  if (pendingCount === 0 && flaggedCount === 0) {
    return matchedCount > 0 ? (
      <Chip label={`All ${matchedCount} matched`} className={`${matched.text} ${matched.bg}`} />
    ) : (
      <Chip label="No bills yet" className="text-ink-muted bg-white/70" />
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {pendingCount > 0 && <Chip label={`${pendingCount} pending`} className={`${pending.text} ${pending.bg}`} />}
      {flaggedCount > 0 && <Chip label={`${flaggedCount} flagged`} className={`${flagged.text} ${flagged.bg}`} />}
      {matchedCount > 0 && <Chip label={`${matchedCount} matched`} className={`${matched.text} ${matched.bg}`} />}
    </div>
  )
}
