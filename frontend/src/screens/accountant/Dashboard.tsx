import { Link, useNavigate } from 'react-router-dom'
import { IconTruck } from '../../components/icons'
import { useSession } from '../../lib/session'
import { useApiGet } from '../../lib/api'
import type { Project, ProjectAccent } from '../../lib/types'

const accentBg: Record<ProjectAccent, string> = {
  accent: 'bg-accent',
  forest: 'bg-forest',
  clay: 'bg-clay',
}

interface OfficeStats {
  toReview: number
  discrepancies: number
  matchedMTD: number
}

export function AccountantDashboard() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const { data: projectsData, loading, error } = useApiGet<{ projects: Project[] }>('/api/projects')
  const { data: stats } = useApiGet<OfficeStats>('/api/office/stats')

  return (
    <div className="flex flex-col flex-grow text-ink">
      <div className="flex-shrink-0 px-5 pt-5 pb-4 bg-surface border-b border-border">
        <div className="text-xs text-ink-muted font-medium">Office review</div>
        <div className="flex items-center justify-between mt-0.5">
          <div className="text-xl font-bold">{user?.name}</div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            aria-label="Log out"
            className="w-[38px] h-[38px] rounded-full bg-avatar-bg flex items-center justify-center text-[13px] font-bold text-accent"
          >
            {user?.initials}
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pt-4 pb-1 grid grid-cols-3 gap-2.5">
        <div className="bg-surface border border-border rounded-card py-[13px] px-2.5 text-center">
          <div className="text-xl font-bold">{stats?.toReview ?? '–'}</div>
          <div className="text-[10.5px] text-ink-muted mt-0.5">To review</div>
        </div>
        <div className="bg-warning-bg border border-warning-border rounded-card py-[13px] px-2.5 text-center">
          <div className="text-xl font-bold text-warning-text">{stats?.discrepancies ?? '–'}</div>
          <div className="text-[10.5px] text-warning-text mt-0.5">Discrepancies</div>
        </div>
        <div className="bg-success-bg border border-success-border rounded-card py-[13px] px-2.5 text-center">
          <div className="text-xl font-bold text-success-text">{stats?.matchedMTD ?? '–'}</div>
          <div className="text-[10.5px] text-success-text mt-0.5">Matched, MTD</div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto px-4 py-[18px]">
        <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2.5">Projects</div>

        {loading && <div className="text-sm text-ink-muted">Loading projects…</div>}
        {error && <div className="text-sm text-warning-text">{error}</div>}

        <div className="flex flex-col gap-2.5">
          {projectsData?.projects.map((project) => (
            <Link
              key={project.id}
              to={`/accountant/projects/${project.id}/gallery`}
              className="flex items-center gap-3 bg-surface border border-border rounded-card p-[15px]"
            >
              <div
                className={`w-11 h-11 rounded-btn flex items-center justify-center flex-shrink-0 ${accentBg[project.accent]}`}
              >
                <IconTruck size={18} stroke="#FFFFFF" />
              </div>
              <div className="flex-grow">
                <div className="text-sm font-bold">{project.code}</div>
                <div className="text-xs text-ink-muted mt-px">{project.name}</div>
              </div>
              <div
                className={`text-[11px] font-bold rounded-md px-2 py-1 whitespace-nowrap ${
                  project.toReview > 0 ? 'text-warning-text bg-warning-bg' : 'text-ink-muted bg-surface-alt'
                }`}
              >
                {project.toReview} to review
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
