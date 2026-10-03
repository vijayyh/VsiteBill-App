import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AuthImage } from '../../components/AuthImage'
import { BillSummary } from '../../components/BillSummary'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ScreenHeader } from '../../components/ScreenHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { IconCamera, IconClock } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import { subscribeQueue, useQueuedUploads, type QueuedUpload } from '../../lib/offlineQueue'
import type { Delivery, Project } from '../../lib/types'

type Tab = 'WAITING' | 'TODAY' | 'ALL'

const EMPTY_MESSAGE: Record<Tab, string> = {
  WAITING: 'Nothing waiting. Bills added with no signal wait here and send by themselves when you’re back online.',
  TODAY: 'You haven’t sent any bills today.',
  ALL: 'You haven’t added any bills to this project yet.',
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

const thumbClass = 'w-[60px] h-[60px] rounded-lg bg-camera-bg flex-shrink-0 overflow-hidden'
const cardClass = 'flex gap-3 bg-surface border rounded-card p-3 shadow-[0_1px_2px_rgba(20,24,26,0.04)]'

function WaitingCard({ item }: { item: QueuedUpload }) {
  return (
    <div className={`${cardClass} border-warning-border`}>
      <div className={thumbClass}>
        <QueuedPhotoThumb blob={item.blob} />
      </div>
      <div className="flex-grow min-w-0">
        <BillSummary
          vendor={item.vendor}
          item={item.item}
          badge={
            <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-[3px] whitespace-nowrap text-warning-text bg-warning-bg">
              <IconClock size={11} stroke="var(--color-warning-text)" strokeWidth={2.5} />
              Waiting for signal
            </span>
          }
          delivered={item.delivered === '' ? null : Number(item.delivered)}
          poNumber={item.poNumber || null}
          timestamp={item.createdAt}
        />
      </div>
    </div>
  )
}

function SentCard({ delivery, onViewPhoto }: { delivery: Delivery; onViewPhoto: (src: string) => void }) {
  return (
    <div className={`${cardClass} border-border`}>
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

  const tabs: { key: Tab; label: string; count: number; active: string; idle: string }[] = [
    { key: 'WAITING', label: 'Waiting to send', count: queued.length, active: 'bg-warning-text text-white', idle: 'bg-warning-bg text-warning-text' },
    { key: 'TODAY', label: 'Sent today', count: sentToday.length, active: 'bg-success-text text-white', idle: 'bg-success-bg text-success-text' },
    { key: 'ALL', label: 'All bills', count: sent.length + queued.length, active: 'bg-accent text-white', idle: 'bg-surface text-ink border border-border' },
  ]

  const showQueued = tab === 'WAITING' || tab === 'ALL'
  const visibleSent = tab === 'TODAY' ? sentToday : tab === 'ALL' ? sent : []
  const isEmpty = (showQueued ? queued.length : 0) + visibleSent.length === 0

  return (
    <div className="flex flex-col flex-grow min-h-0 text-ink">
      <ScreenHeader backTo="/supervisor" title={project?.code ?? ''} subtitle={project?.name} />

      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <Link
          to={`/supervisor/projects/${projectId}/upload`}
          className="flex items-center justify-center gap-2.5 w-full py-5 rounded-cta bg-accent text-white"
        >
          <IconCamera size={24} stroke="#FFFFFF" />
          <div className="text-base font-bold">Add a bill</div>
        </Link>
      </div>

      <div className="flex-shrink-0 flex gap-2 px-4 pt-2 pb-2 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 text-[12px] font-bold rounded-full px-3.5 py-1.5 ${tab === t.key ? t.active : t.idle}`}
          >
            {t.label} · {t.count}
          </button>
        ))}
      </div>

      <div className="flex-grow overflow-y-auto px-4 pt-1.5 pb-4 flex flex-col gap-2.5">
        {deliveriesLoading && <div className="text-sm text-ink-muted text-center mt-6">Loading bills…</div>}
        {!deliveriesLoading && isEmpty && (
          <div className="text-sm text-ink-muted text-center mt-6 px-6 leading-relaxed">{EMPTY_MESSAGE[tab]}</div>
        )}
        {showQueued && queued.map((item) => <WaitingCard key={item.id} item={item} />)}
        {visibleSent.map((delivery) => (
          <SentCard key={delivery.id} delivery={delivery} onViewPhoto={setViewerSrc} />
        ))}
        {!isEmpty && (
          <div className="text-xs text-ink-faint text-center mt-2 leading-relaxed">
            The office team checks each bill against its purchase order.
          </div>
        )}
      </div>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
