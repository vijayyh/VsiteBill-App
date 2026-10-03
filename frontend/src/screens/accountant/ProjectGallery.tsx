import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AuthImage } from '../../components/AuthImage'
import { BillSummary } from '../../components/BillSummary'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ScreenHeader } from '../../components/ScreenHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { useApiGet } from '../../lib/api'
import { STATUS_META } from '../../lib/status'
import type { Delivery, DeliveryStatus, Project } from '../../lib/types'

type Filter = 'ALL' | DeliveryStatus

const EMPTY_MESSAGE: Record<Filter, string> = {
  ALL: 'No bills have been uploaded for this project yet.',
  PENDING: 'Nothing waiting for review.',
  REVIEW: 'No flagged bills. Bills you flag for follow-up will stay here.',
  MATCHED: 'No matched bills yet. Every bill you match stays here permanently.',
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
    <div className="flex gap-3 bg-surface border border-border rounded-card p-3 shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
      <button
        type="button"
        onClick={() => delivery.photoUrl && onViewPhoto(delivery.photoUrl)}
        aria-label="View bill photo"
        className="w-[60px] h-[60px] rounded-lg bg-camera-bg flex-shrink-0 overflow-hidden"
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
  const { data: projectData, error: projectError } = useApiGet<{ project: Project }>(
    `/api/projects/${projectId}`,
  )
  const { data: deliveriesData, loading } = useApiGet<{ deliveries: Delivery[] }>(
    `/api/projects/${projectId}/deliveries`,
  )
  const [filter, setFilter] = useState<Filter>('ALL')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  if (projectError) return <Navigate to="/accountant" replace />
  const project = projectData?.project
  const deliveries = deliveriesData?.deliveries ?? []

  const countOf = (status: DeliveryStatus) => deliveries.filter((d) => d.status === status).length
  const visible = filter === 'ALL' ? deliveries : deliveries.filter((d) => d.status === filter)

  const tabs: { key: Filter; label: string; count: number; active: string; idle: string }[] = [
    { key: 'ALL', label: 'All bills', count: deliveries.length, active: 'bg-accent text-white', idle: 'bg-surface text-ink border border-border' },
    ...(['PENDING', 'REVIEW', 'MATCHED'] as const).map((status) => {
      const meta = STATUS_META[status]
      return {
        key: status,
        label: meta.label,
        count: countOf(status),
        active: `${meta.dot} text-white`,
        idle: `${meta.bg} ${meta.text}`,
      }
    }),
  ]

  return (
    <div className="flex flex-col flex-grow min-h-0 text-ink">
      <ScreenHeader backTo="/accountant" title={project?.code ?? ''} subtitle={project?.name} />

      <div className="flex-shrink-0 flex gap-2 px-4 pt-3.5 pb-2 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-shrink-0 text-[12px] font-bold rounded-full px-3.5 py-1.5 ${
              filter === tab.key ? tab.active : tab.idle
            }`}
          >
            {tab.label} · {tab.count}
          </button>
        ))}
      </div>

      <div className="flex-grow overflow-y-auto px-4 pt-1.5 pb-4 flex flex-col gap-2.5">
        {loading && <div className="text-sm text-ink-muted text-center mt-6">Loading bills…</div>}
        {!loading && visible.length === 0 && (
          <div className="text-sm text-ink-muted text-center mt-6 px-6 leading-relaxed">{EMPTY_MESSAGE[filter]}</div>
        )}
        {visible.map((delivery) => (
          <BillCard key={delivery.id} delivery={delivery} projectId={projectId} onViewPhoto={setViewerSrc} />
        ))}
      </div>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
