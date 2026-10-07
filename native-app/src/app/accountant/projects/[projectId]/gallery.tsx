import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthImage } from '../../../../components/AuthImage'
import { BillSummary, StatusBadge } from '../../../../components/bills'
import { IconBill, IconCloud } from '../../../../components/icons'
import { PhotoViewer } from '../../../../components/PhotoViewer'
import { HeroPill, ProjectHero } from '../../../../components/projects'
import { Screen } from '../../../../components/Screen'
import { T } from '../../../../components/T'
import { EmptyState, FilterTabs, Tap, type TabOption } from '../../../../components/ui'
import { useApiGet } from '../../../../lib/api'
import { STATUS_META } from '../../../../lib/status'
import { colors, glass, radii, ring } from '../../../../lib/theme'
import type { Delivery, DeliveryStatus, OfficeDrive, Project } from '../../../../lib/types'

// Same as the web app's project gallery (frontend/src/screens/accountant/ProjectGallery.tsx).
type Filter = 'ALL' | DeliveryStatus

const EMPTY: Record<Filter, { title: string; body: string }> = {
  ALL: { title: 'No bills yet', body: 'Bills supervisors send for this project will appear here.' },
  PENDING: { title: 'Nothing pending', body: 'Every bill for this project has been reviewed.' },
  REVIEW: { title: 'No flagged bills', body: 'Bills you flag for follow-up stay here until they’re matched.' },
  MATCHED: { title: 'No matched bills yet', body: 'Every bill you match stays here permanently.' },
}

function BillCard({ delivery, projectId, onViewPhoto }: { delivery: Delivery; projectId: string; onViewPhoto: (src: string) => void }) {
  return (
    <View style={[glass, styles.card]}>
      <Tap onPress={() => delivery.photoUrl && onViewPhoto(delivery.photoUrl)} accessibilityLabel="View bill photo" style={styles.thumb}>
        {delivery.photoUrl ? <AuthImage src={delivery.photoUrl} /> : null}
      </Tap>
      <Tap onPress={() => router.push(`/accountant/projects/${projectId}/review/${delivery.id}`)} style={{ flex: 1, minWidth: 0 }}>
        <BillSummary
          vendor={delivery.vendor}
          item={delivery.item}
          badge={<StatusBadge status={delivery.status} />}
          delivered={delivery.delivered}
          ordered={delivery.ordered}
          poNumber={delivery.poNumber}
          note={delivery.note}
          byline={delivery.uploadedBy}
          timestamp={delivery.uploadedAt}
          inDrive={!!delivery.driveFileId}
        />
      </Tap>
    </View>
  )
}

export default function ProjectGallery() {
  const { projectId = '' } = useLocalSearchParams<{ projectId: string }>()
  const insets = useSafeAreaInsets()
  const projectQuery = useApiGet<{ project: Project }>(`/api/projects/${projectId}`)
  const deliveries = useApiGet<{ deliveries: Delivery[] }>(`/api/projects/${projectId}/deliveries`)
  const { data: drive } = useApiGet<OfficeDrive>('/api/office/drive')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  if (projectQuery.error) return <Redirect href="/accountant" />
  const project = projectQuery.data?.project
  const all = deliveries.data?.deliveries ?? []
  const projectFolderUrl = drive?.projectFolderUrls?.[projectId]

  const countOf = (status: DeliveryStatus) => all.filter((d) => d.status === status).length
  const visible = filter === 'ALL' ? all : all.filter((d) => d.status === filter)
  const tabs: TabOption<Filter>[] = [
    { key: 'ALL', label: 'All bills', count: all.length },
    ...(['PENDING', 'REVIEW', 'MATCHED'] as const).map((status) => ({
      key: status,
      label: STATUS_META[status].label,
      count: countOf(status),
      dot: STATUS_META[status].dot,
    })),
  ]
  const back = () => (router.canGoBack() ? router.back() : router.replace('/accountant/projects'))

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={deliveries.refreshing} onRefresh={deliveries.refresh} colors={[colors.accent]} />}
        ListHeaderComponent={
          <View>
            <ProjectHero
              onBack={back}
              code={project?.code}
              name={project?.name}
              accent={project?.accent}
              action={
                projectFolderUrl ? (
                  <HeroPill onPress={() => void Linking.openURL(projectFolderUrl)} accessibilityLabel="Open this project's folder in Google Drive (view-only)">
                    <IconCloud size={13} stroke={colors.white} />
                    <T size={12} weight={700} color={colors.white}>
                      Drive ↗
                    </T>
                  </HeroPill>
                ) : null
              }
              stats={[
                { value: countOf('PENDING'), label: STATUS_META.PENDING.label },
                { value: countOf('REVIEW'), label: STATUS_META.REVIEW.label },
                { value: countOf('MATCHED'), label: STATUS_META.MATCHED.label },
              ]}
            />
            <View style={{ marginTop: 16, marginBottom: 12 }}>
              <FilterTabs tabs={tabs} value={filter} onChange={setFilter} />
            </View>
            {deliveries.loading ? (
              <T size={14} lh={20 / 14} color={colors.inkMuted} style={{ textAlign: 'center', marginTop: 16 }}>
                Loading bills…
              </T>
            ) : null}
            {!deliveries.loading && visible.length === 0 ? (
              <View style={{ paddingHorizontal: 20 }}>
                <EmptyState icon={IconBill} title={EMPTY[filter].title} body={EMPTY[filter].body} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            <BillCard delivery={item} projectId={projectId} onViewPhoto={setViewerSrc} />
          </View>
        )}
      />
      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </Screen>
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
