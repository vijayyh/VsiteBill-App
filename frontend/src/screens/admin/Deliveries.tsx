import { useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { AuthImage } from '../../components/AuthImage'
import { IconCheck, IconCloud } from '../../components/icons'
import { PhotoViewer } from '../../components/PhotoViewer'
import { useApiGet } from '../../lib/api'
import type { AdminDelivery, DeliveryStatus } from '../../lib/types'

const badgeStyle: Record<DeliveryStatus, { text: string; bg: string }> = {
  MATCHED: { text: 'text-success-text', bg: 'bg-success-bg' },
  REVIEW: { text: 'text-warning-text', bg: 'bg-warning-bg' },
  PENDING: { text: 'text-ink-muted', bg: 'bg-surface-alt' },
}

function formatDate(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today, ${time}`
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`
}

export function AdminDeliveries() {
  const { data } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/admin/deliveries')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  const deliveries = data?.deliveries ?? []

  return (
    <AdminShell title="Deliveries">
      {deliveries.length === 0 && (
        <div className="text-sm text-ink-muted text-center mt-6">No deliveries uploaded yet.</div>
      )}

      <div className="flex flex-col gap-2.5">
        {deliveries.map((entry) => {
          const style = badgeStyle[entry.status]
          return (
            <div key={entry.id} className="bg-surface border border-border rounded-card p-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => entry.photoUrl && setViewerSrc(entry.photoUrl)}
                  className="w-11 h-11 rounded-lg bg-camera-bg flex-shrink-0 overflow-hidden"
                >
                  {entry.photoUrl && <AuthImage src={entry.photoUrl} className="w-full h-full object-cover" />}
                </button>
                <div className="flex-grow min-w-0">
                  <div className="text-[13px] font-bold truncate">{entry.vendor || 'Unidentified vendor'}</div>
                  <div className="text-[11px] text-ink-muted mt-px truncate">
                    {entry.project.code} &middot; {entry.item || 'Pending extraction'}
                  </div>
                  <div className="text-[10.5px] text-ink-faint mt-[3px]">
                    {formatDate(entry.uploadedAt)} &middot; {entry.uploadedBy}
                  </div>
                </div>
                <div
                  className={`text-[10px] font-bold rounded-md px-2 py-1 whitespace-nowrap ${style.text} ${style.bg}`}
                >
                  {entry.status}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-border">
                {entry.driveFileId ? (
                  <a
                    href={entry.driveWebViewLink ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-success-text"
                  >
                    <IconCheck size={12} stroke="var(--color-success-text)" strokeWidth={2.5} />
                    Saved to Drive
                  </a>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-faint">
                    <IconCloud size={12} stroke="var(--color-ink-faint)" />
                    Not saved to Drive yet
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </AdminShell>
  )
}
