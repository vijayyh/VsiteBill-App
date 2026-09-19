import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AuthImage } from '../../components/AuthImage'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useApiGet } from '../../lib/api'
import type { Delivery, DeliveryStatus, Project } from '../../lib/types'

type Filter = 'ALL' | 'REVIEW' | 'MATCHED'

const badgeStyle: Record<DeliveryStatus, { text: string; bg: string; dot: string }> = {
  MATCHED: { text: 'text-success-text', bg: 'bg-success-bg', dot: 'bg-success-text' },
  REVIEW: { text: 'text-warning-text', bg: 'bg-warning-bg', dot: 'bg-warning-text' },
  PENDING: { text: 'text-ink-muted', bg: 'bg-surface-alt', dot: 'bg-ink-faint' },
}

function formatDate(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today, ${time}`
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`
}

export function ProjectGallery() {
  const { projectId = '' } = useParams()
  const { data: projectData, error: projectError } = useApiGet<{ project: Project }>(
    `/api/projects/${projectId}`,
  )
  const { data: deliveriesData } = useApiGet<{ deliveries: Delivery[] }>(
    `/api/projects/${projectId}/deliveries`,
  )
  const [filter, setFilter] = useState<Filter>('ALL')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  if (projectError) return <Navigate to="/accountant" replace />
  const project = projectData?.project
  const deliveries = deliveriesData?.deliveries ?? []

  const reviewCount = deliveries.filter((d) => d.status === 'REVIEW' || d.status === 'PENDING').length
  const matchedCount = deliveries.filter((d) => d.status === 'MATCHED').length
  const visible = deliveries.filter((d) => {
    if (filter === 'ALL') return true
    if (filter === 'REVIEW') return d.status === 'REVIEW' || d.status === 'PENDING'
    return d.status === filter
  })

  const chips: { key: Filter; label: string; activeClasses: string; idleClasses: string }[] = [
    { key: 'ALL', label: `All (${deliveries.length})`, activeClasses: 'bg-accent text-white', idleClasses: 'bg-surface-alt text-ink-muted' },
    { key: 'REVIEW', label: `To review (${reviewCount})`, activeClasses: 'bg-warning-text text-white', idleClasses: 'bg-warning-bg text-warning-text' },
    { key: 'MATCHED', label: `Matched (${matchedCount})`, activeClasses: 'bg-success-text text-white', idleClasses: 'bg-success-bg text-success-text' },
  ]

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ScreenHeader backTo="/accountant" title={project?.code ?? ''} subtitle="Delivery gallery" />

      <div className="flex-shrink-0 flex gap-2 px-4 pt-3.5 pb-1">
        {chips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key)}
            className={`text-xs font-bold rounded-full px-[13px] py-1.5 ${
              filter === chip.key ? chip.activeClasses : chip.idleClasses
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex-grow overflow-y-auto px-4 py-3.5">
        {visible.length === 0 && (
          <div className="text-sm text-ink-muted text-center mt-6">No deliveries in this view yet.</div>
        )}
        {visible.map((entry) => {
          const style = badgeStyle[entry.status]
          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-xl p-2.5 mb-[9px]"
            >
              <button
                type="button"
                onClick={() => entry.photoUrl && setViewerSrc(entry.photoUrl)}
                aria-label="View bill photo"
                className="w-[52px] h-[52px] rounded-lg bg-camera-bg flex-shrink-0 relative overflow-hidden"
              >
                {entry.photoUrl && (
                  <AuthImage src={entry.photoUrl} className="w-full h-full object-cover" />
                )}
                <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface ${style.dot}`} />
              </button>
              <Link
                to={`/accountant/projects/${projectId}/review/${entry.id}`}
                className="flex-grow min-w-0 flex items-center gap-3"
              >
                <div className="flex-grow min-w-0">
                  <div className="text-[13.5px] font-bold truncate">{entry.vendor || 'Unidentified vendor'}</div>
                  <div className="text-xs text-ink-muted mt-px truncate">{entry.item || 'Pending extraction'}</div>
                  <div className="text-[11px] text-ink-faint mt-[3px]">{formatDate(entry.uploadedAt)}</div>
                </div>
                <div className={`text-[10.5px] font-bold rounded-md px-2 py-1 whitespace-nowrap ${style.text} ${style.bg}`}>
                  {entry.status}
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </div>
  )
}
