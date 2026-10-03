import { useState } from 'react'
import { BillRow } from '../../components/BillRow'
import { TabScreen } from '../../components/BottomNav'
import { EmptyState, FilterTabs, PageTitle, SearchField, type TabOption } from '../../components/ui'
import { IconClipboardCheck } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import { STATUS_META } from '../../lib/status'
import type { AdminDelivery, DeliveryStatus } from '../../lib/types'

type Filter = 'TODO' | 'ALL' | DeliveryStatus

/** The accountant's queue: every bill across all projects, defaulting to the ones still needing action. */
export function ReviewQueue() {
  const { data, loading } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/deliveries')
  const [filter, setFilter] = useState<Filter>('TODO')
  const [query, setQuery] = useState('')

  const bills = data?.deliveries ?? []
  const q = query.trim().toLowerCase()
  const visible = bills.filter((b) => {
    const statusOk =
      filter === 'ALL' || (filter === 'TODO' ? b.status === 'PENDING' || b.status === 'REVIEW' : b.status === filter)
    const queryOk =
      !q ||
      [b.vendor, b.item, b.poNumber ?? '', b.project.code, b.project.name, b.uploadedBy ?? ''].some((s) =>
        s.toLowerCase().includes(q),
      )
    return statusOk && queryOk
  })

  const count = (s: DeliveryStatus) => bills.filter((b) => b.status === s).length
  const tabs: TabOption<Filter>[] = [
    { key: 'TODO', label: 'Needs action', count: count('PENDING') + count('REVIEW') },
    ...(['PENDING', 'REVIEW', 'MATCHED'] as const).map((s) => ({
      key: s,
      label: STATUS_META[s].label,
      count: count(s),
      dot: STATUS_META[s].dot,
    })),
    { key: 'ALL', label: 'All', count: bills.length },
  ]

  return (
    <TabScreen>
      <PageTitle title="Review" subtitle="Check each bill against its purchase order" />
      <div className="px-5">
        <SearchField value={query} onChange={setQuery} placeholder="Search vendor, PO, project or supervisor" />
      </div>
      <div className="mt-3">
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
      </div>
      <div className="px-5 mt-3 flex flex-col gap-2.5">
        {loading && <div className="text-sm text-ink-muted text-center mt-4">Loading bills…</div>}
        {!loading && visible.length === 0 && (
          <EmptyState
            icon={IconClipboardCheck}
            title={q ? 'No bills match your search' : filter === 'TODO' ? 'Nothing to review' : 'No bills here'}
            body={filter === 'TODO' && !q ? 'Every bill is matched. New ones from site will appear here.' : undefined}
          />
        )}
        {visible.map((bill) => (
          <BillRow
            key={bill.id}
            bill={bill}
            to={`/accountant/projects/${bill.projectId}/review/${bill.id}`}
            from="/accountant/review"
            showThumb
            showUploader
          />
        ))}
      </div>
    </TabScreen>
  )
}
