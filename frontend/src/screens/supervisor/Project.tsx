import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { AuthImage } from '../../components/AuthImage'
import { BillSummary } from '../../components/BillSummary'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ProjectHero } from '../../components/ProjectHero'
import { StatusBadge } from '../../components/StatusBadge'
import { EmptyState, FilterTabs, btnPrimary, type TabOption } from '../../components/ui'
import { IconBill, IconCamera, IconCheck, IconClock } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import { subscribeQueue, useQueuedUploads, type QueuedUpload } from '../../lib/offlineQueue'
import type { Delivery, Project } from '../../lib/types'

type Tab = 'WAITING' | 'TODAY' | 'ALL'

const EMPTY: Record<Tab, { icon: typeof IconBill; title: string; body: string }> = {
  WAITING: {
    icon: IconClock,
    title: 'Nothing waiting',
    body: 'Bills added with no signal wait here and send by themselves when you’re back online.',
  },
  TODAY: { icon: IconCheck, title: 'Nothing sent today', body: 'Bills you send today will show up here.' },
  ALL: { icon: IconBill, title: 'No bills yet', body: 'Tap “Add a bill” to photograph your first bill for this project.' },
}

function QueuedPhotoThumb({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  if (!url) return null
  return <img src={url} alt="" className="w-full h-full object-cover" />
}

const thumbClass = 'w-[60px] h-[60px] rounded-[12px] bg-camera-bg flex-shrink-0 overflow-hidden ring-1 ring-white/70'

function WaitingCard({ item }: { item: QueuedUpload }) {
  return (
    <div className="glass rounded-card p-3 ring-1 ring-warning-border/60">
      {/* Full-width status strip, so a long vendor name isn't squeezed by a wide badge. */}
      <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-warning-text bg-warning-bg rounded-full px-2.5 py-1 mb-2.5 w-fit">
        <IconClock size={12} stroke="var(--color-warning-text)" strokeWidth={2.5} />
        Waiting for signal · sends by itself
      </div>
      <div className="flex gap-3">
        <div className={thumbClass}>
          <QueuedPhotoThumb blob={item.blob} />
        </div>
        <div className="flex-grow min-w-0">
          <BillSummary
            vendor={item.vendor}
            item={item.item}
            badge={null}
            delivered={item.delivered === '' ? null : Number(item.delivered)}
            poNumber={item.poNumber || null}
            timestamp={item.createdAt}
          />
        </div>
      </div>
    </div>
  )
}

function SentCard({ delivery, onViewPhoto }: { delivery: Delivery; onViewPhoto: (src: string) => void }) {
  return (
    <div className="glass rounded-card flex gap-3 p-3">
      <button
        type="button"
        onClick={() => delivery.photoUrl && onViewPhoto(delivery.photoUrl)}
        aria-label="View bill photo"
        className={thumbClass}
      >
        {delivery.photoUrl && <AuthImage src={delivery.photoUrl} className="w-full h-full object-cover" />}
      </button>
      <div className="flex-grow min-w-0">
        <BillSummary
          vendor={delivery.vendor}
          item={delivery.item}
          badge={<StatusBadge status={delivery.status} />}
          delivered={delivery.delivered}
          poNumber={delivery.poNumber}
          note={delivery.status === 'REVIEW' ? delivery.note : null}
          timestamp={delivery.uploadedAt}
        />
      </div>
    </div>
  )
}

export function SupervisorProject() {
  const { projectId = '' } = useParams()
  const backTo = (useLocation().state as { from?: string } | null)?.from ?? '/supervisor'
  const { data: projectData, error: projectError } = useApiGet<{ project: Project }>(
    `/api/projects/${projectId}`,
  )
  const {
    data: deliveriesData,
    loading: deliveriesLoading,
    refetch: refetchDeliveries,
  } = useApiGet<{ deliveries: Delivery[] }>(`/api/projects/${projectId}/deliveries?uploadedByMe=1`)
  const queued = useQueuedUploads(projectId)
  const [tab, setTab] = useState<Tab>('ALL')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  // A queue flush (item removed after a successful background upload) means
  // there's a new server-side bill to pick up — re-fetch so it moves from
  // "Waiting" to "Sent" instead of just disappearing until the next visit.
  useEffect(() => subscribeQueue(refetchDeliveries), [refetchDeliveries])

  if (projectError) return <Navigate to="/supervisor" replace />
  const project = projectData?.project
  const sent = deliveriesData?.deliveries ?? []
  const today = new Date().toDateString()
  const sentToday = sent.filter((d) => new Date(d.uploadedAt).toDateString() === today)
  const flagged = sent.filter((d) => d.status === 'REVIEW').length

  const tabs: TabOption<Tab>[] = [
    { key: 'ALL', label: 'All bills', count: sent.length + queued.length },
    { key: 'WAITING', label: 'Waiting to send', count: queued.length, dot: 'bg-warning-text' },
    { key: 'TODAY', label: 'Sent today', count: sentToday.length, dot: 'bg-success-text' },
  ]

  const showQueued = tab === 'WAITING' || tab === 'ALL'
  const visibleSent = tab === 'TODAY' ? sentToday : tab === 'ALL' ? sent : []
  const isEmpty = (showQueued ? queued.length : 0) + visibleSent.length === 0
  const empty = EMPTY[tab]

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ProjectHero
        backTo={backTo}
        code={project?.code}
        name={project?.name}
        accent={project?.accent}
        stats={[
          { value: sentToday.length, label: 'Sent today' },
          { value: queued.length, label: 'Waiting' },
          { value: flagged, label: 'Flagged' },
        ]}
      />

      <div className="px-5 pt-4">
        <Link to={`/supervisor/projects/${projectId}/upload`} className={`${btnPrimary} w-full py-4 text-[15px]`}>
          <IconCamera size={21} stroke="#FFFFFF" />
          Add a bill
        </Link>
      </div>

      <div className="mt-4">
        <FilterTabs tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <div className="px-5 pt-3 pb-8 flex flex-col gap-2.5">
        {deliveriesLoading && <div className="text-sm text-ink-muted text-center mt-4">Loading bills…</div>}
        {!deliveriesLoading && isEmpty && <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />}
        {showQueued && queued.map((item) => <WaitingCard key={item.id} item={item} />)}
        {visibleSent.map((delivery) => (
          <SentCard key={delivery.id} delivery={delivery} onViewPhoto={setViewerSrc} />
        ))}
        {!isEmpty && (
          <div className="text-[11.5px] text-ink-faint text-center mt-2 leading-relaxed">
            The office team checks each bill against its purchase order.
          </div>
        )}
      </div>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
