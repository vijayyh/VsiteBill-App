import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminShell } from '../../components/AdminShell'
import { AuthImage } from '../../components/AuthImage'
import { BillSummary } from '../../components/BillSummary'
import { PhotoViewer } from '../../components/PhotoViewer'
import { StatusBadge } from '../../components/StatusBadge'
import { EmptyState, FilterTabs, SearchField, type TabOption } from '../../components/ui'
import { IconBill } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import { STATUS_META } from '../../lib/status'
import type { AdminDelivery, DeliveryStatus } from '../../lib/types'

type Filter = 'ALL' | DeliveryStatus

export function AdminDeliveries() {
  const { data, loading } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/admin/deliveries')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const bills = data?.deliveries ?? []
  const q = query.trim().toLowerCase()
  const visible = bills.filter(
    (b) =>
      (filter === 'ALL' || b.status === filter) &&
      (!q ||
        [b.vendor, b.item, b.poNumber ?? '', b.project.code, b.project.name, b.uploadedBy ?? ''].some((s) =>
          s.toLowerCase().includes(q),
        )),
  )
  const tabs: TabOption<Filter>[] = [
    { key: 'ALL', label: 'All', count: bills.length },
    ...(['PENDING', 'REVIEW', 'MATCHED'] as const).map((s) => ({
      key: s,
      label: STATUS_META[s].label,
      count: bills.filter((b) => b.status === s).length,
      dot: STATUS_META[s].dot,
    })),
  ]

  return (
    <AdminShell title="Bills" subtitle="Every bill, across all projects">
      <SearchField value={query} onChange={setQuery} placeholder="Search vendor, PO, project or supervisor" />
      <div className="-mx-5 mt-3">
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
      </div>

      <div className="flex flex-col gap-2.5 mt-3">
        {loading && <div className="text-sm text-ink-muted text-center mt-4">Loading bills…</div>}
        {!loading && visible.length === 0 && (
          <EmptyState icon={IconBill} title={q ? 'No bills match your search' : 'No bills here yet'} />
        )}
        {visible.map((bill) => (
          <div key={bill.id} className="glass rounded-card flex gap-3 p-3">
            <button
              type="button"
              onClick={() => bill.photoUrl && setViewerSrc(bill.photoUrl)}
              aria-label="View bill photo"
              className="w-[60px] h-[60px] rounded-[12px] bg-camera-bg flex-shrink-0 overflow-hidden ring-1 ring-white/70"
            >
              {bill.photoUrl && <AuthImage src={bill.photoUrl} className="w-full h-full object-cover" />}
            </button>
            <Link
              to={`/admin/projects/${bill.projectId}/review/${bill.id}`}
              state={{ from: '/admin/deliveries' }}
              aria-label={`Open the bill from ${bill.vendor || 'unknown vendor'}`}
              className="flex-grow min-w-0"
            >
              <BillSummary
                vendor={bill.vendor}
                item={`${bill.project.code} · ${bill.item || 'No item description'}`}
                badge={<StatusBadge status={bill.status} />}
                delivered={bill.delivered}
                ordered={bill.ordered}
                poNumber={bill.poNumber}
                note={bill.note}
                byline={bill.uploadedBy}
                timestamp={bill.uploadedAt}
                inDrive={!!bill.driveFileId}
              />
            </Link>
          </div>
        ))}
      </div>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </AdminShell>
  )
}
