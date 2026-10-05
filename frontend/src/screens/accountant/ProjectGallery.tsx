import { useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { AuthImage } from '../../components/AuthImage'
import { BillSummary } from '../../components/BillSummary'
import { IconBill, IconCloud } from '../../components/icons'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ProjectHero, heroPill } from '../../components/ProjectHero'
import { StatusBadge } from '../../components/StatusBadge'
import { EmptyState, FilterTabs, type TabOption } from '../../components/ui'
import { useApiGet } from '../../lib/api'
import { STATUS_META } from '../../lib/status'
import type { Delivery, DeliveryStatus, OfficeDrive, Project } from '../../lib/types'

type Filter = 'ALL' | DeliveryStatus

const EMPTY: Record<Filter, { title: string; body: string }> = {
  ALL: { title: 'No bills yet', body: 'Bills supervisors send for this project will appear here.' },
  PENDING: { title: 'Nothing pending', body: 'Every bill for this project has been reviewed.' },
  REVIEW: { title: 'No flagged bills', body: 'Bills you flag for follow-up stay here until they’re matched.' },
  MATCHED: { title: 'No matched bills yet', body: 'Every bill you match stays here permanently.' },
}

function BillCard({
  delivery,
  projectId,
  onViewPhoto,
}: {
  delivery: Delivery
  projectId: string
  onViewPhoto: (src: string) => void
}) {
  return (
    <div className="glass rounded-card flex gap-3 p-3">
      <button
        type="button"
        onClick={() => delivery.photoUrl && onViewPhoto(delivery.photoUrl)}
        aria-label="View bill photo"
        className="w-[60px] h-[60px] rounded-[12px] bg-camera-bg flex-shrink-0 overflow-hidden ring-1 ring-white/70"
      >
        {delivery.photoUrl && <AuthImage src={delivery.photoUrl} className="w-full h-full object-cover" />}
      </button>

      <Link to={`/accountant/projects/${projectId}/review/${delivery.id}`} className="flex-grow min-w-0 block">
        <BillSummary
          vendor={delivery.vendor}
          item={delivery.item}
          badge={<StatusBadge status={delivery.status} />}
          delivered={delivery.delivered}
          ordered={delivery.ordered}
          poNumber={delivery.poNumber}
          note={delivery.note}
          byline={delivery.uploadedBy}
          timestamp={delivery.uploadedAt}
          inDrive={!!delivery.driveFileId}
        />
      </Link>
    </div>
  )
}

export function ProjectGallery() {
  const { projectId = '' } = useParams()
  const backTo = (useLocation().state as { from?: string } | null)?.from ?? '/accountant/projects'
  const { data: projectData, error: projectError } = useApiGet<{ project: Project }>(
    `/api/projects/${projectId}`,
  )
  const { data: deliveriesData, loading } = useApiGet<{ deliveries: Delivery[] }>(
    `/api/projects/${projectId}/deliveries`,
  )
  const { data: drive } = useApiGet<OfficeDrive>('/api/office/drive')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  if (projectError) return <Navigate to="/accountant" replace />
  const project = projectData?.project
  const deliveries = deliveriesData?.deliveries ?? []
  const projectFolderUrl = drive?.projectFolderUrls?.[projectId]

  const countOf = (status: DeliveryStatus) => deliveries.filter((d) => d.status === status).length
  const visible = filter === 'ALL' ? deliveries : deliveries.filter((d) => d.status === filter)

  const tabs: TabOption<Filter>[] = [
    { key: 'ALL', label: 'All bills', count: deliveries.length },
    ...(['PENDING', 'REVIEW', 'MATCHED'] as const).map((status) => ({
      key: status,
      label: STATUS_META[status].label,
      count: countOf(status),
      dot: STATUS_META[status].dot,
    })),
  ]

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ProjectHero
        backTo={backTo}
        code={project?.code}
        name={project?.name}
        accent={project?.accent}
        action={
          projectFolderUrl && (
            <a
              href={projectFolderUrl}
              target="_blank"
              rel="noreferrer"
              title="Open this project's folder in Google Drive (view-only)"
              className={heroPill}
            >
              <IconCloud size={13} stroke="#FFFFFF" />
              Drive ↗
            </a>
          )
        }
        stats={[
          { value: countOf('PENDING'), label: STATUS_META.PENDING.label },
          { value: countOf('REVIEW'), label: STATUS_META.REVIEW.label },
          { value: countOf('MATCHED'), label: STATUS_META.MATCHED.label },
        ]}
      />

      <div className="mt-4">
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
      </div>

      <div className="px-5 pt-3 pb-8 flex flex-col gap-2.5">
        {loading && <div className="text-sm text-ink-muted text-center mt-4">Loading bills…</div>}
        {!loading && visible.length === 0 && (
          <EmptyState icon={IconBill} title={EMPTY[filter].title} body={EMPTY[filter].body} />
        )}
        {visible.map((delivery) => (
          <BillCard key={delivery.id} delivery={delivery} projectId={projectId} onViewPhoto={setViewerSrc} />
        ))}
      </div>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
