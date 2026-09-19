import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AuthImage } from '../../components/AuthImage'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ScreenHeader } from '../../components/ScreenHeader'
import { IconCamera, IconCheck, IconClock } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import { subscribeQueue, useQueuedUploads } from '../../lib/offlineQueue'
import type { Delivery, Project } from '../../lib/types'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
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

export function SupervisorProject() {
  const { projectId = '' } = useParams()
  const { data: projectData, error: projectError } = useApiGet<{ project: Project }>(
    `/api/projects/${projectId}`,
  )
  const {
    data: deliveriesData,
    loading: deliveriesLoading,
    refetch: refetchDeliveries,
  } = useApiGet<{ deliveries: Delivery[] }>(`/api/projects/${projectId}/deliveries?uploadedByMe=1&today=1`)
  const queued = useQueuedUploads(projectId)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  // A queue flush (item removed after a successful background upload) means
  // there's a new server-side delivery to pick up — re-fetch so it moves from
  // "Queued" to "Uploaded" instead of just disappearing until the next visit.
  useEffect(() => subscribeQueue(refetchDeliveries), [refetchDeliveries])

  if (projectError) return <Navigate to="/supervisor" replace />
  const project = projectData?.project
  const uploaded = deliveriesData?.deliveries ?? []
  const nothingYet = !deliveriesLoading && uploaded.length === 0 && queued.length === 0

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ScreenHeader backTo="/supervisor" title={project?.code ?? ''} subtitle={project?.name} />

      <div className="flex-shrink-0 px-4 pt-[22px] pb-2.5">
        <Link
          to={`/supervisor/projects/${projectId}/upload`}
          className="flex items-center justify-center gap-2.5 w-full py-5 rounded-cta bg-accent text-white"
        >
          <IconCamera size={24} stroke="#FFFFFF" />
          <div className="text-base font-bold">Add delivery photo</div>
        </Link>
      </div>

      <div className="flex-grow overflow-y-auto px-4 py-3.5">
        <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2.5">Today's uploads</div>

        {deliveriesLoading && <div className="text-sm text-ink-muted">Loading…</div>}
        {nothingYet && <div className="text-sm text-ink-muted">Nothing uploaded yet today.</div>}

        <div className="flex flex-col gap-[9px]">
          {queued.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-surface border border-warning-border rounded-card p-3"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-alt flex-shrink-0 overflow-hidden">
                <QueuedPhotoThumb blob={item.blob} />
              </div>
              <div className="flex-grow">
                <div className="text-[13.5px] font-semibold">Delivery photo</div>
                <div className="text-[11.5px] text-ink-faint mt-px">{formatTime(item.createdAt)}</div>
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-warning-text">
                <IconClock size={13} stroke="var(--color-warning-text)" strokeWidth={2.5} />
                Queued
              </div>
            </div>
          ))}

          {uploaded.map((delivery) => (
            <div
              key={delivery.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-card p-3"
            >
              <button
                type="button"
                onClick={() => delivery.photoUrl && setViewerSrc(delivery.photoUrl)}
                className="w-10 h-10 rounded-lg bg-surface-alt flex-shrink-0 overflow-hidden"
              >
                {delivery.photoUrl && (
                  <AuthImage src={delivery.photoUrl} className="w-full h-full object-cover" />
                )}
              </button>
              <div className="flex-grow">
                <div className="text-[13.5px] font-semibold">{delivery.vendor || 'Delivery photo'}</div>
                <div className="text-[11.5px] text-ink-faint mt-px">{formatTime(delivery.uploadedAt)}</div>
              </div>
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-muted">
                <IconCheck size={13} stroke="var(--color-ink-muted)" strokeWidth={2.5} />
                Uploaded
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-ink-faint text-center mt-4 leading-relaxed">
          The office team reviews and matches these against purchase orders.
        </div>
      </div>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
