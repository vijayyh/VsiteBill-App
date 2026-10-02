import { useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { AuthImage } from '../../components/AuthImage'
import { IconCheck, IconCloud } from '../../components/icons'
import { PhotoViewer } from '../../components/PhotoViewer'
import { StatusBadge } from '../../components/StatusBadge'
import { useApiGet } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import type { AdminDelivery } from '../../lib/types'

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
                  <div className="text-[13px] font-bold truncate">{entry.vendor || 'Vendor not entered'}</div>
                  <div className="text-[11px] text-ink-muted mt-px truncate">
                    {entry.project.code} &middot; {entry.item || 'No item description'}
                  </div>
                  <div className="text-[10.5px] text-ink-faint mt-[3px]">
                    {formatDateTime(entry.uploadedAt)}
                    {entry.uploadedBy ? ` · ${entry.uploadedBy}` : ''}
                  </div>
                </div>
                <StatusBadge status={entry.status} />
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
