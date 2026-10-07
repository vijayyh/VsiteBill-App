import { useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { BillRow } from '../../../components/bills'
import { useTabBarSpace } from '../../../components/BottomNav'
import { IconClipboardCheck } from '../../../components/icons'
import { Screen } from '../../../components/Screen'
import { T } from '../../../components/T'
import { EmptyState, FilterTabs, PageTitle, SearchField, type TabOption } from '../../../components/ui'
import { useApiGet } from '../../../lib/api'
import { STATUS_META } from '../../../lib/status'
import { colors } from '../../../lib/theme'
import type { AdminDelivery, DeliveryStatus } from '../../../lib/types'

// Same as the web app's Review queue (frontend/src/screens/accountant/Review.tsx).
type Filter = 'TODO' | 'ALL' | DeliveryStatus

/** The accountant's queue: every bill across all projects, defaulting to the ones still needing action. */
export default function ReviewQueue() {
  const space = useTabBarSpace()
  const { data, loading, refresh, refreshing } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/deliveries')
  const [filter, setFilter] = useState<Filter>('TODO')
  const [query, setQuery] = useState('')

  const bills = data?.deliveries ?? []
  const q = query.trim().toLowerCase()
  const visible = bills.filter((b) => {
    const statusOk = filter === 'ALL' || (filter === 'TODO' ? b.status === 'PENDING' || b.status === 'REVIEW' : b.status === filter)
    const queryOk =
      !q || [b.vendor, b.item, b.poNumber ?? '', b.project.code, b.project.name, b.uploadedBy ?? ''].some((s) => s.toLowerCase().includes(q))
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
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(b) => String(b.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
        ListHeaderComponent={
          <View>
            <PageTitle title="Review" subtitle="Check each bill against its purchase order" />
            <View style={{ paddingHorizontal: 20 }}>
              <SearchField value={query} onChange={setQuery} placeholder="Search vendor, PO, project or supervisor" />
            </View>
            <View style={{ marginTop: 12, marginBottom: 12 }}>
              <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
            </View>
            {loading ? (
              <T size={14} lh={20 / 14} color={colors.inkMuted} style={{ textAlign: 'center', marginTop: 16 }}>
                Loading bills…
              </T>
            ) : null}
            {!loading && visible.length === 0 ? (
              <View style={{ paddingHorizontal: 20 }}>
                <EmptyState
                  icon={IconClipboardCheck}
                  title={q ? 'No bills match your search' : filter === 'TODO' ? 'Nothing to review' : 'No bills here'}
                  body={filter === 'TODO' && !q ? 'Every bill is matched. New ones from site will appear here.' : undefined}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: bill }) => (
          <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            <BillRow bill={bill} to={`/accountant/projects/${bill.projectId}/review/${bill.id}`} showThumb showUploader />
          </View>
        )}
      />
    </Screen>
  )
}
