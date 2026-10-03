import { useMemo, useState } from 'react'
import { BillRow } from '../../components/BillRow'
import { TabScreen } from '../../components/BottomNav'
import { EmptyState, FilterTabs, PageTitle, SearchField, type TabOption } from '../../components/ui'
import { IconBill, IconClock } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useQueuedUploads } from '../../lib/offlineQueue'
import { STATUS_META } from '../../lib/status'
import type { AdminDelivery, DeliveryStatus } from '../../lib/types'

type Filter = 'ALL' | 'WAITING' | DeliveryStatus

function dayLabel(iso: string) {
  const label = formatDateTime(iso)
  return label.slice(0, label.lastIndexOf(','))
}

/** Every bill this supervisor has sent, across all projects — searchable and filterable. */
export function MyBills() {
  const { data, loading } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/deliveries')
  const queued = useQueuedUploads()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const bills = useMemo(() => data?.deliveries ?? [], [data])
  const q = query.trim().toLowerCase()
  const matchesQuery = (b: AdminDelivery) =>
    !q || [b.vendor, b.item, b.poNumber ?? '', b.project.code, b.project.name].some((s) => s.toLowerCase().includes(q))

  const visible = filter === 'WAITING' ? [] : bills.filter((b) => (filter === 'ALL' || b.status === filter) && matchesQuery(b))
  const showQueued = (filter === 'ALL' || filter === 'WAITING') && !q

  const groups: { day: string; bills: AdminDelivery[] }[] = []
  for (const bill of visible) {
    const day = dayLabel(bill.uploadedAt)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.bills.push(bill)
    else groups.push({ day, bills: [bill] })
  }

  const count = (s: DeliveryStatus) => bills.filter((b) => b.status === s).length
  const tabs: TabOption<Filter>[] = [
    { key: 'ALL', label: 'All', count: bills.length + queued.length },
    { key: 'WAITING', label: 'Waiting', count: queued.length, dot: 'bg-warning-text' },
    ...(['PENDING', 'REVIEW', 'MATCHED'] as const).map((s) => ({
      key: s,
      label: STATUS_META[s].label,
      count: count(s),
      dot: STATUS_META[s].dot,
    })),
  ]

  const nothing = !loading && groups.length === 0 && !(showQueued && queued.length)

  return (
    <TabScreen>
      <PageTitle title="My bills" subtitle="Every bill you've sent, across all projects" />
      <div className="px-5">
        <SearchField value={query} onChange={setQuery} placeholder="Search vendor, item, PO or project" />
      </div>
      <div className="mt-3">
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
      </div>

      <div className="px-5 mt-3 flex flex-col gap-2.5">
        {loading && <div className="text-sm text-ink-muted text-center mt-4">Loading bills…</div>}

        {showQueued && queued.length > 0 && (
          <>
            <div className="text-[12px] font-bold text-warning-text uppercase tracking-wide mt-1">Waiting for signal</div>
            {queued.map((item) => (
              <div key={item.id} className="glass rounded-card flex items-center gap-3 px-3.5 py-3 ring-1 ring-warning-border/60">
                <span className="w-9 h-9 rounded-full bg-warning-bg flex items-center justify-center flex-shrink-0">
                  <IconClock size={16} stroke="var(--color-warning-text)" strokeWidth={2.4} />
                </span>
                <div className="flex-grow min-w-0">
                  <div className="text-[13.5px] font-bold truncate">{item.vendor || 'Bill photo'}</div>
                  <div className="text-[11.5px] text-ink-muted">Saved {formatDateTime(item.createdAt)} · sends automatically</div>
                </div>
              </div>
            ))}
          </>
        )}

        {groups.map((group) => (
          <div key={group.day} className="flex flex-col gap-2.5">
            <div className="text-[12px] font-bold text-ink-muted uppercase tracking-wide mt-2">{group.day}</div>
            {group.bills.map((bill) => (
              <BillRow key={bill.id} bill={bill} to={`/supervisor/projects/${bill.projectId}`} showThumb />
            ))}
          </div>
        ))}

        {nothing && (
          <EmptyState
            icon={IconBill}
            title={q ? 'No bills match your search' : 'Nothing here yet'}
            body={q ? 'Try a vendor name, item, PO number or project code.' : 'Bills you send will show up here, newest first.'}
          />
        )}
      </div>
    </TabScreen>
  )
}
