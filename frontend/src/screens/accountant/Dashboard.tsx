import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { BillRow } from '../../components/BillRow'
import { TabScreen } from '../../components/BottomNav'
import { ProjectCard } from '../../components/ProjectCard'
import { ProjectCounts } from '../../components/ProjectCounts'
import { Card, EmptyState, SectionTitle, StatTile, btnPrimary } from '../../components/ui'
import { IconAlertTriangle, IconBill, IconCheck, IconClipboardCheck, IconClock, IconCloud } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import type { AdminDelivery, OfficeDrive, ProjectSummary } from '../../lib/types'

interface OfficeStats {
  pending: number
  flagged: number
  matchedThisMonth: number
}

function DriveArchiveCard({ drive }: { drive: OfficeDrive | null }) {
  if (!drive) return null
  if (!drive.connected) {
    return (
      <Card className="p-3.5 flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-white/70 ring-1 ring-white flex items-center justify-center flex-shrink-0">
          <IconCloud size={18} stroke="var(--color-ink-faint)" />
        </span>
        <div className="text-[12.5px] text-ink-muted leading-snug">
          Google Drive isn’t connected yet. An admin can connect it from the admin panel.
        </div>
      </Card>
    )
  }
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-success-bg ring-1 ring-white flex items-center justify-center flex-shrink-0">
          <IconCloud size={18} stroke="var(--color-success-text)" />
        </span>
        <div className="flex-grow min-w-0">
          <div className="text-[13.5px] font-bold">Bills archive in Google Drive</div>
          <div className="text-[11.5px] text-ink-muted truncate">
            {drive.sharedDriveName ? `Shared Drive: ${drive.sharedDriveName}` : `My Drive of ${drive.email}`}
          </div>
        </div>
        {drive.rootFolderUrl && (
          <a href={drive.rootFolderUrl} target="_blank" rel="noreferrer" className={`${btnPrimary} px-3.5 py-2 text-[12px]`}>
            Open ↗
          </a>
        )}
      </div>
      <div className="text-[11px] text-ink-faint mt-2.5 leading-snug">
        View-only. If Google asks for access, ask an admin to add your Google account as a Viewer.
      </div>
    </Card>
  )
}

export function AccountantDashboard() {
  const { data: projectsData, loading, error } = useApiGet<{ projects: ProjectSummary[] }>('/api/projects')
  const { data: stats } = useApiGet<OfficeStats>('/api/office/stats')
  const { data: drive } = useApiGet<OfficeDrive>('/api/office/drive')
  const { data: billsData } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/deliveries')

  const toReview = (stats?.pending ?? 0) + (stats?.flagged ?? 0)
  const latest = (billsData?.deliveries ?? []).slice(0, 4)

  return (
    <TabScreen>
      <AppHeader />

      <div className="px-5 grid grid-cols-3 gap-2.5">
        <StatTile value={stats?.pending ?? '–'} label="Pending" icon={IconClock} tint="bg-info-bg text-info-text" />
        <StatTile value={stats?.flagged ?? '–'} label="Flagged" icon={IconAlertTriangle} tint="bg-warning-bg text-warning-text" />
        <StatTile value={stats?.matchedThisMonth ?? '–'} label="Matched this month" icon={IconCheck} tint="bg-success-bg text-success-text" />
      </div>

      <div className="px-5 mt-4">
        <div className="rounded-card p-4 text-white bg-gradient-to-br from-[#2f5f8a] to-accent shadow-[0_16px_32px_-18px_rgba(26,60,94,0.9)] ring-1 ring-white/30 flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-white/15 ring-1 ring-white/30 flex items-center justify-center flex-shrink-0">
            <IconClipboardCheck size={20} stroke="#FFFFFF" />
          </span>
          <div className="flex-grow min-w-0">
            <div className="text-[15px] font-bold">{toReview ? `${toReview} bills need review` : 'All caught up'}</div>
            <div className="text-[12px] text-white/75">
              {toReview ? 'Pending and flagged bills, across every project' : 'No pending or flagged bills right now'}
            </div>
          </div>
          {toReview > 0 && (
            <Link to="/accountant/review" className="flex-shrink-0 rounded-full bg-white text-accent text-[12.5px] font-bold px-3.5 py-2">
              Review
            </Link>
          )}
        </div>
      </div>

      <div className="px-5 mt-4">
        <DriveArchiveCard drive={drive} />
      </div>

      <div className="px-5 mt-6">
        <SectionTitle title="Projects" to="/accountant/projects" />
        {loading && <div className="text-sm text-ink-muted">Loading projects…</div>}
        {error && <div className="text-sm text-warning-text">{error}</div>}
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 scroll-px-5 pb-2 snap-x snap-mandatory [scrollbar-width:none]">
        {projectsData?.projects.map((project) => (
          <ProjectCard
            key={project.id}
            to={`/accountant/projects/${project.id}/gallery`}
            code={project.code}
            name={project.name}
            accent={project.accent}
            className="w-[78%] flex-shrink-0 snap-start"
            footer={<ProjectCounts project={project} />}
          />
        ))}
      </div>

      <div className="px-5 mt-5">
        <SectionTitle title="Latest bills" to="/accountant/review" linkLabel="Review queue" />
        {latest.length === 0 ? (
          <EmptyState icon={IconBill} title="No bills yet" body="Bills supervisors send from site will appear here." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {latest.map((bill) => (
              <BillRow
                key={bill.id}
                bill={bill}
                to={`/accountant/projects/${bill.projectId}/review/${bill.id}`}
                from="/accountant"
                showUploader
              />
            ))}
          </div>
        )}
      </div>
    </TabScreen>
  )
}
