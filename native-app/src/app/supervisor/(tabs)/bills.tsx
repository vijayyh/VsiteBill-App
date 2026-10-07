import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { BillRow } from '../../../components/bills'
import { useTabBarSpace } from '../../../components/BottomNav'
import { IconBill, IconClock } from '../../../components/icons'
import { Screen } from '../../../components/Screen'
import { T } from '../../../components/T'
import { EmptyState, FilterTabs, PageTitle, SearchField, type TabOption } from '../../../components/ui'
import { useApiGet } from '../../../lib/api'
import { formatDateTime } from '../../../lib/format'
import { useQueuedUploads, type QueuedUpload } from '../../../lib/offlineQueue'
import { STATUS_META } from '../../../lib/status'
import { colors, glass, radii } from '../../../lib/theme'
import type { AdminDelivery, DeliveryStatus } from '../../../lib/types'

// Same as the web app's My bills (frontend/src/screens/supervisor/MyBills.tsx).
type Filter = 'ALL' | 'WAITING' | DeliveryStatus

type Item =
  | { kind: 'waitingTitle' }
  | { kind: 'queued'; item: QueuedUpload }
  | { kind: 'day'; day: string }
  | { kind: 'bill'; bill: AdminDelivery }

function dayLabel(iso: string) {
  const label = formatDateTime(iso)
  return label.slice(0, label.lastIndexOf(','))
}

export default function MyBills() {
  const space = useTabBarSpace()
  const { data, loading, refresh, refreshing } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/deliveries')
  const queued = useQueuedUploads()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const bills = useMemo(() => data?.deliveries ?? [], [data])
  const q = query.trim().toLowerCase()
  const matchesQuery = (b: AdminDelivery) =>
    !q || [b.vendor, b.item, b.poNumber ?? '', b.project.code, b.project.name].some((s) => s.toLowerCase().includes(q))
  const visible = filter === 'WAITING' ? [] : bills.filter((b) => (filter === 'ALL' || b.status === filter) && matchesQuery(b))
  const showQueued = (filter === 'ALL' || filter === 'WAITING') && !q

  const items: Item[] = []
  if (showQueued && queued.length > 0) {
    items.push({ kind: 'waitingTitle' })
    queued.forEach((item) => items.push({ kind: 'queued', item }))
  }
  let lastDay = ''
  for (const bill of visible) {
    const day = dayLabel(bill.uploadedAt)
    if (day !== lastDay) {
      items.push({ kind: 'day', day })
      lastDay = day
    }
    items.push({ kind: 'bill', bill })
  }

  const count = (s: DeliveryStatus) => bills.filter((b) => b.status === s).length
  const tabs: TabOption<Filter>[] = [
    { key: 'ALL', label: 'All', count: bills.length + queued.length },
    { key: 'WAITING', label: 'Waiting', count: queued.length, dot: colors.warningText },
    ...(['PENDING', 'REVIEW', 'MATCHED'] as const).map((s) => ({
      key: s,
      label: STATUS_META[s].label,
      count: count(s),
      dot: STATUS_META[s].dot,
    })),
  ]

  const nothing = !loading && items.length === 0

  const header = (
    <View>
      <PageTitle title="My bills" subtitle="Every bill you've sent, across all projects" />
      <View style={{ paddingHorizontal: 20 }}>
        <SearchField value={query} onChange={setQuery} placeholder="Search vendor, item, PO or project" />
      </View>
      <View style={{ marginTop: 12, marginBottom: 12 }}>
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
      </View>
      {loading ? (
        <T size={14} lh={20 / 14} color={colors.inkMuted} style={{ textAlign: 'center', marginTop: 16 }}>
          Loading bills…
        </T>
      ) : null}
    </View>
  )

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(it, i) => (it.kind === 'bill' ? `b${it.bill.id}` : it.kind === 'queued' ? `q${it.item.id}` : `${it.kind}${i}`)}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
        ListEmptyComponent={
          nothing ? (
            <View style={{ paddingHorizontal: 20 }}>
              <EmptyState
                icon={IconBill}
                title={q ? 'No bills match your search' : 'Nothing here yet'}
                body={q ? 'Try a vendor name, item, PO number or project code.' : 'Bills you send will show up here, newest first.'}
              />
            </View>
          ) : null
        }
        renderItem={({ item: it }) => {
          switch (it.kind) {
            case 'waitingTitle':
              return (
                <T size={12} weight={700} color={colors.warningText} style={[styles.groupTitle, { marginTop: 4 }]}>
                  Waiting for signal
                </T>
              )
            case 'queued':
              return (
                <View style={styles.cell}>
                  <View style={[glass, styles.queued]}>
                    <View style={styles.queuedIcon}>
                      <IconClock size={16} stroke={colors.warningText} strokeWidth={2.4} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T size={13.5} weight={700} numberOfLines={1}>
                        {it.item.vendor || 'Bill photo'}
                      </T>
                      <T size={11.5} color={colors.inkMuted}>
                        Saved {formatDateTime(it.item.createdAt)} · sends automatically
                      </T>
                    </View>
                  </View>
                </View>
              )
            case 'day':
              return (
                <T size={12} weight={700} color={colors.inkMuted} style={[styles.groupTitle, { marginTop: 8 }]}>
                  {it.day}
                </T>
              )
            case 'bill':
              return (
                <View style={styles.cell}>
                  <BillRow bill={it.bill} to={`/supervisor/projects/${it.bill.projectId}`} showThumb />
                </View>
              )
          }
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  groupTitle: { textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: 20, marginBottom: 10 },
  cell: { paddingHorizontal: 20, marginBottom: 10 },
  queued: {
    borderRadius: radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  queuedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
