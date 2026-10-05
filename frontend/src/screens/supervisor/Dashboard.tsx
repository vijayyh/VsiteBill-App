import { AppHeader } from '../../components/AppHeader'
import { BillRow } from '../../components/BillRow'
import { TabScreen } from '../../components/BottomNav'
import { ProjectCard } from '../../components/ProjectCard'
import { EmptyState, SectionTitle, StatTile } from '../../components/ui'
import { IconAlertTriangle, IconBill, IconCheck, IconClock } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import { useQueuedUploads } from '../../lib/offlineQueue'
import type { AdminDelivery, Project } from '../../lib/types'

export function SupervisorDashboard() {
  const { data: projectsData, loading, error } = useApiGet<{ projects: Project[] }>('/api/projects')
  const { data: billsData } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/deliveries')
  const queued = useQueuedUploads()

  const bills = billsData?.deliveries ?? []
  const today = new Date().toDateString()
  const sentToday = bills.filter((b) => new Date(b.uploadedAt).toDateString() === today).length
  const flagged = bills.filter((b) => b.status === 'REVIEW').length
  const countFor = (projectId: string) => bills.filter((b) => b.projectId === projectId).length

  return (
    <TabScreen>
      <AppHeader />

      <div className="px-5 grid grid-cols-3 gap-2.5">
        <StatTile value={sentToday} label="Sent today" icon={IconCheck} tint="bg-success-bg text-success-text" />
        <StatTile value={queued.length} label="Waiting for signal" icon={IconClock} tint="bg-warning-bg text-warning-text" />
        <StatTile value={flagged} label="Flagged by office" icon={IconAlertTriangle} tint="bg-info-bg text-info-text" />
      </div>

      <div className="px-5 mt-6">
        <SectionTitle title="Your projects" />
        {loading && <div className="text-sm text-ink-muted">Loading projects…</div>}
        {error && <div className="text-sm text-warning-text">{error}</div>}
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 scroll-px-5 pb-2 snap-x snap-mandatory [scrollbar-width:none]">
        {projectsData?.projects.map((project) => (
          <ProjectCard
            key={project.id}
            to={`/supervisor/projects/${project.id}`}
            code={project.code}
            name={project.name}
            accent={project.accent}
            className="w-[78%] flex-shrink-0 snap-start"
            footer={
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-ink-muted">
                  <b className="text-ink">{countFor(project.id)}</b> bills from you
                </span>
                <span className="font-bold text-accent">Open →</span>
              </div>
            }
          />
        ))}
      </div>

      <div className="px-5 mt-5">
        <SectionTitle title="Recent bills" to="/supervisor/bills" />
        {bills.length === 0 ? (
          <EmptyState
            icon={IconBill}
            title="No bills yet"
            body="Bills you send will appear here. Tap the camera button to add your first one."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {bills.slice(0, 4).map((bill) => (
              <BillRow key={bill.id} bill={bill} to={`/supervisor/projects/${bill.projectId}`} />
            ))}
          </div>
        )}
      </div>
    </TabScreen>
  )
}
