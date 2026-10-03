import { Link, useNavigate } from 'react-router-dom'
import { IconChevronRight, IconCloud, IconTruck } from '../../components/icons'
import { useSession } from '../../lib/session'
import { useApiGet } from '../../lib/api'
import { greeting } from '../../lib/format'
import { STATUS_META } from '../../lib/status'
import type { OfficeDrive, ProjectAccent, ProjectSummary } from '../../lib/types'

const accentBg: Record<ProjectAccent, string> = {
  accent: 'bg-accent',
  forest: 'bg-forest',
  clay: 'bg-clay',
}

interface OfficeStats {
  pending: number
  flagged: number
  matchedThisMonth: number
}

function DriveArchiveCard({ drive }: { drive: OfficeDrive | null }) {
  if (!drive) return null

  if (!drive.connected) {
    return (
      <div className="bg-surface border border-border rounded-card p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center flex-shrink-0">
          <IconCloud size={17} stroke="var(--color-ink-faint)" />
        </div>
        <div className="text-[12.5px] text-ink-muted leading-snug">
          Google Drive isn’t connected yet. An admin can connect it from the admin panel.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-card p-3.5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-success-bg flex items-center justify-center flex-shrink-0">
          <IconCloud size={17} stroke="var(--color-success-text)" />
        </div>
        <div className="flex-grow min-w-0">
          <div className="text-[13.5px] font-bold">Bills archive in Google Drive</div>
          <div className="text-[11.5px] text-ink-muted truncate">
            {drive.sharedDriveName ? `Shared Drive: ${drive.sharedDriveName}` : `My Drive of ${drive.email}`}
          </div>
        </div>
        {drive.rootFolderUrl && (
          <a
            href={drive.rootFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0 text-[12px] font-bold text-white bg-accent rounded-btn px-3 py-2"
          >
            Open ↗
          </a>
        )}
      </div>
      <div className="text-[11px] text-ink-faint mt-2.5 leading-snug">
        View-only. If Google asks for access, ask an admin to add your Google account as a Viewer.
      </div>
    </div>
  )
}

function CountChip({ label, className }: { label: string; className: string }) {
  return <span className={`text-[10.5px] font-bold rounded-full px-2 py-[3px] whitespace-nowrap ${className}`}>{label}</span>
}

function ProjectCounts({ project }: { project: ProjectSummary }) {
  const { pendingCount, flaggedCount, matchedCount } = project
  const pending = STATUS_META.PENDING
  const flagged = STATUS_META.REVIEW
  const matched = STATUS_META.MATCHED

  if (pendingCount === 0 && flaggedCount === 0) {
    return matchedCount > 0 ? (
      <CountChip label="All matched" className={`${matched.text} ${matched.bg}`} />
    ) : (
      <CountChip label="No bills yet" className="text-ink-muted bg-surface-alt" />
    )
  }
  return (
    <>
      {pendingCount > 0 && <CountChip label={`${pendingCount} pending`} className={`${pending.text} ${pending.bg}`} />}
      {flaggedCount > 0 && <CountChip label={`${flaggedCount} flagged`} className={`${flagged.text} ${flagged.bg}`} />}
    </>
  )
}

export function AccountantDashboard() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const { data: projectsData, loading, error } = useApiGet<{ projects: ProjectSummary[] }>('/api/projects')
  const { data: stats } = useApiGet<OfficeStats>('/api/office/stats')
  const { data: drive } = useApiGet<OfficeDrive>('/api/office/drive')

  const tiles = [
    { label: 'Pending', value: stats?.pending, meta: STATUS_META.PENDING },
    { label: 'Flagged', value: stats?.flagged, meta: STATUS_META.REVIEW },
    { label: 'Matched this month', value: stats?.matchedThisMonth, meta: STATUS_META.MATCHED },
  ]

  return (
    <div className="flex flex-col flex-grow min-h-0 text-ink">
      <div className="flex-shrink-0 px-5 pt-5 pb-4 bg-surface border-b border-border">
        <div className="text-xs text-ink-muted font-medium">{greeting()}</div>
        <div className="flex items-center justify-between mt-0.5">
          <div>
            <div className="text-xl font-bold">{user?.name}</div>
            <div className="text-[11.5px] text-ink-muted mt-px">Office · bill review</div>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            aria-label="Log out"
            title="Log out"
            className="w-[38px] h-[38px] rounded-full bg-avatar-bg flex items-center justify-center text-[13px] font-bold text-accent"
          >
            {user?.initials}
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pt-4 pb-1 grid grid-cols-3 gap-2.5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`border rounded-card py-3 px-2 text-center ${tile.meta.bg} ${tile.meta.border}`}
          >
            <div className={`text-[22px] font-bold leading-none ${tile.meta.text}`}>{tile.value ?? '–'}</div>
            <div className={`text-[10.5px] font-semibold mt-1.5 leading-tight ${tile.meta.text}`}>{tile.label}</div>
          </div>
        ))}
      </div>

      <div className="flex-grow overflow-y-auto px-4 py-[18px]">
        <div className="mb-[18px]">
          <DriveArchiveCard drive={drive} />
        </div>

        <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2.5">Projects</div>

        {loading && <div className="text-sm text-ink-muted">Loading projects…</div>}
        {error && <div className="text-sm text-warning-text">{error}</div>}

        <div className="flex flex-col gap-2.5">
          {projectsData?.projects.map((project) => (
            <Link
              key={project.id}
              to={`/accountant/projects/${project.id}/gallery`}
              className="flex items-center gap-3 bg-surface border border-border rounded-card p-[14px] shadow-[0_1px_2px_rgba(20,24,26,0.04)]"
            >
              <div
                className={`w-11 h-11 rounded-btn flex items-center justify-center flex-shrink-0 ${accentBg[project.accent]}`}
              >
                <IconTruck size={18} stroke="#FFFFFF" />
              </div>
              <div className="flex-grow min-w-0">
                <div className="text-sm font-bold">{project.code}</div>
                <div className="text-xs text-ink-muted mt-px truncate">{project.name}</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <ProjectCounts project={project} />
                </div>
              </div>
              <IconChevronRight size={18} stroke="var(--color-ink-faint)" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
