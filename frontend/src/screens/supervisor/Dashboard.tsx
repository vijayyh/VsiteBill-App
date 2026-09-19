import { Link, useNavigate } from 'react-router-dom'
import { IconChevronRight, IconTruck } from '../../components/icons'
import { useSession } from '../../lib/session'
import { useApiGet } from '../../lib/api'
import type { Project, ProjectAccent } from '../../lib/types'

const accentBg: Record<ProjectAccent, string> = {
  accent: 'bg-accent',
  forest: 'bg-forest',
  clay: 'bg-clay',
}

export function SupervisorDashboard() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const { data, loading, error } = useApiGet<{ projects: Project[] }>('/api/projects')

  return (
    <div className="flex flex-col flex-grow text-ink">
      <div className="flex-shrink-0 px-5 pt-5 pb-4 bg-surface border-b border-border">
        <div className="text-xs text-ink-muted font-medium">Good morning</div>
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

      <div className="flex-grow overflow-y-auto px-4 py-[18px]">
        <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2.5">Your projects</div>

        {loading && <div className="text-sm text-ink-muted">Loading projects…</div>}
        {error && <div className="text-sm text-warning-text">{error}</div>}

        <div className="flex flex-col gap-2.5">
          {data?.projects.map((project) => (
            <Link
              key={project.id}
              to={`/supervisor/projects/${project.id}`}
              className="flex items-center gap-3 bg-surface border border-border rounded-card p-[15px] shadow-[0_1px_2px_rgba(20,24,26,0.04)]"
            >
              <div
                className={`w-[46px] h-[46px] rounded-btn flex items-center justify-center flex-shrink-0 ${accentBg[project.accent]}`}
              >
                <IconTruck size={20} stroke="#FFFFFF" />
              </div>
              <div className="flex-grow">
                <div className="text-[14.5px] font-bold">{project.code}</div>
                <div className="text-[12.5px] text-ink-muted mt-px">{project.name}</div>
              </div>
              <IconChevronRight size={18} stroke="var(--color-ink-faint)" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
