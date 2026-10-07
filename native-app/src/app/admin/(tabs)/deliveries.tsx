import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { AdminShell } from '../../../components/AdminShell'
import { AuthImage } from '../../../components/AuthImage'
import { BillSummary, StatusBadge } from '../../../components/bills'
import { IconBill } from '../../../components/icons'
import { PhotoViewer } from '../../../components/PhotoViewer'
import { T } from '../../../components/T'
import { EmptyState, FilterTabs, SearchField, Tap, type TabOption } from '../../../components/ui'
import { useApiGet } from '../../../lib/api'
import { STATUS_META } from '../../../lib/status'
import { colors, glass, radii, ring } from '../../../lib/theme'
import type { AdminDelivery, DeliveryStatus } from '../../../lib/types'

// Same as the web app's admin Bills tab (frontend/src/screens/admin/Deliveries.tsx).
type Filter = 'ALL' | DeliveryStatus

export default function AdminDeliveries() {
  const { data, loading, refresh, refreshing } = useApiGet<{ deliveries: AdminDelivery[] }>('/api/admin/deliveries')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const bills = data?.deliveries ?? []
  const q = query.trim().toLowerCase()
  const visible = bills.filter(
    (b) =>
      (filter === 'ALL' || b.status === filter) &&
      (!q || [b.vendor, b.item, b.poNumber ?? '', b.project.code, b.project.name, b.uploadedBy ?? ''].some((s) => s.toLowerCase().includes(q))),
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
    <AdminShell title="Bills" subtitle="Every bill, across all projects" refreshing={refreshing} onRefresh={refresh}>
      <SearchField value={query} onChange={setQuery} placeholder="Search vendor, PO, project or supervisor" />
      <View style={{ marginHorizontal: -20, marginTop: 12 }}>
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
      </View>

      <View style={{ gap: 10, marginTop: 12 }}>
        {loading ? (
          <T size={14} lh={20 / 14} color={colors.inkMuted} style={{ textAlign: 'center', marginTop: 16 }}>
            Loading bills…
          </T>
        ) : null}
        {!loading && visible.length === 0 ? <EmptyState icon={IconBill} title={q ? 'No bills match your search' : 'No bills here yet'} /> : null}
        {visible.map((bill) => (
          <View key={bill.id} style={[glass, styles.card]}>
            <Tap onPress={() => bill.photoUrl && setViewerSrc(bill.photoUrl)} accessibilityLabel="View bill photo" style={styles.thumb}>
              {bill.photoUrl ? <AuthImage src={bill.photoUrl} /> : null}
            </Tap>
            <View style={{ flex: 1, minWidth: 0 }}>
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
            </View>
          </View>
        ))}
      </View>

      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </AdminShell>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, flexDirection: 'row', gap: 12, padding: 12 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.cameraBg,
    overflow: 'hidden',
    ...ring(1, 'rgba(255,255,255,0.7)'),
  },
})
