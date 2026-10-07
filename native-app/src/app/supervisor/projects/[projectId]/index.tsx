import { Image } from 'expo-image'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthImage } from '../../../../components/AuthImage'
import { BillSummary, StatusBadge } from '../../../../components/bills'
import { IconBill, IconCamera, IconCheck, IconClock, type Icon } from '../../../../components/icons'
import { PhotoViewer } from '../../../../components/PhotoViewer'
import { ProjectHero } from '../../../../components/projects'
import { Screen } from '../../../../components/Screen'
import { T } from '../../../../components/T'
import { EmptyState, FilterTabs, PrimaryButton, Tap, type TabOption } from '../../../../components/ui'
import { useApiGet } from '../../../../lib/api'
import { subscribeQueue, useQueuedUploads, type QueuedUpload } from '../../../../lib/offlineQueue'
import { colors, glass, radii, ring } from '../../../../lib/theme'
import type { Delivery, Project } from '../../../../lib/types'

// Same as the web app's supervisor project screen (frontend/src/screens/supervisor/Project.tsx).
type Tab = 'WAITING' | 'TODAY' | 'ALL'

const EMPTY: Record<Tab, { icon: Icon; title: string; body: string }> = {
  WAITING: {
    icon: IconClock,
    title: 'Nothing waiting',
    body: 'Bills added with no signal wait here and send by themselves when you’re back online.',
  },
  TODAY: { icon: IconCheck, title: 'Nothing sent today', body: 'Bills you send today will show up here.' },
  ALL: { icon: IconBill, title: 'No bills yet', body: 'Tap “Add a bill” to photograph your first bill for this project.' },
}

function WaitingCard({ item }: { item: QueuedUpload }) {
  return (
    <View style={[glass, styles.card]}>
      {/* Full-width status strip, so a long vendor name isn't squeezed by a wide badge. */}
      <View style={styles.strip}>
        <IconClock size={12} stroke={colors.warningText} strokeWidth={2.5} />
        <T size={11.5} weight={700} color={colors.warningText}>
          Waiting for signal · sends by itself
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={styles.thumb}>
          <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <BillSummary
            vendor={item.vendor}
            item={item.item}
            badge={null}
            delivered={item.delivered === '' ? null : Number(item.delivered)}
            poNumber={item.poNumber || null}
            timestamp={item.createdAt}
          />
        </View>
      </View>
    </View>
  )
}

function SentCard({ delivery, onViewPhoto }: { delivery: Delivery; onViewPhoto: (src: string) => void }) {
  return (
    <View style={[glass, styles.card, { flexDirection: 'row', gap: 12 }]}>
      <Tap
        onPress={() => delivery.photoUrl && onViewPhoto(delivery.photoUrl)}
        accessibilityLabel="View bill photo"
        style={styles.thumb}
      >
        {delivery.photoUrl ? <AuthImage src={delivery.photoUrl} /> : null}
      </Tap>
      <View style={{ flex: 1, minWidth: 0 }}>
        <BillSummary
          vendor={delivery.vendor}
          item={delivery.item}
          badge={<StatusBadge status={delivery.status} />}
          delivered={delivery.delivered}
          poNumber={delivery.poNumber}
          note={delivery.status === 'REVIEW' ? delivery.note : null}
          timestamp={delivery.uploadedAt}
        />
      </View>
    </View>
  )
}

type Row = { kind: 'queued'; item: QueuedUpload } | { kind: 'sent'; delivery: Delivery }

export default function SupervisorProject() {
  const { projectId = '' } = useLocalSearchParams<{ projectId: string }>()
  const insets = useSafeAreaInsets()
  const projectQuery = useApiGet<{ project: Project }>(`/api/projects/${projectId}`)
  const deliveries = useApiGet<{ deliveries: Delivery[] }>(`/api/projects/${projectId}/deliveries?uploadedByMe=1`)
  const queued = useQueuedUploads(projectId)
  const [tab, setTab] = useState<Tab>('ALL')
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const refetchDeliveries = deliveries.refetch

  // A queue flush (item removed after a successful background upload) means there's a new
  // server-side bill to pick up — re-fetch so it moves from "Waiting" to "Sent".
  useEffect(() => subscribeQueue(refetchDeliveries), [refetchDeliveries])

  if (projectQuery.error) return <Redirect href="/supervisor" />
  const project = projectQuery.data?.project
  const sent = deliveries.data?.deliveries ?? []
  const today = new Date().toDateString()
  const sentToday = sent.filter((d) => new Date(d.uploadedAt).toDateString() === today)
  const flagged = sent.filter((d) => d.status === 'REVIEW').length

  const tabs: TabOption<Tab>[] = [
    { key: 'ALL', label: 'All bills', count: sent.length + queued.length },
    { key: 'WAITING', label: 'Waiting to send', count: queued.length, dot: colors.warningText },
    { key: 'TODAY', label: 'Sent today', count: sentToday.length, dot: colors.successText },
  ]

  const showQueued = tab === 'WAITING' || tab === 'ALL'
  const visibleSent = tab === 'TODAY' ? sentToday : tab === 'ALL' ? sent : []
  const rows: Row[] = [
    ...(showQueued ? queued.map((item) => ({ kind: 'queued' as const, item })) : []),
    ...visibleSent.map((delivery) => ({ kind: 'sent' as const, delivery })),
  ]
  const isEmpty = rows.length === 0
  const empty = EMPTY[tab]
  const back = () => (router.canGoBack() ? router.back() : router.replace('/supervisor'))

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === 'queued' ? `q${r.item.id}` : `s${r.delivery.id}`)}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={deliveries.refreshing}
            onRefresh={() => {
              deliveries.refresh()
              projectQuery.refetch()
            }}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <View>
            <ProjectHero
              onBack={back}
              code={project?.code}
              name={project?.name}
              accent={project?.accent}
              stats={[
                { value: sentToday.length, label: 'Sent today' },
                { value: queued.length, label: 'Waiting' },
                { value: flagged, label: 'Flagged' },
              ]}
            />
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <PrimaryButton onPress={() => router.push(`/supervisor/projects/${projectId}/upload`)} style={{ paddingVertical: 16 }}>
                <IconCamera size={21} stroke={colors.white} />
                <T size={15} weight={700} color={colors.white}>
                  Add a bill
                </T>
              </PrimaryButton>
            </View>
            <View style={{ marginTop: 16, marginBottom: 12 }}>
              <FilterTabs tabs={tabs} value={tab} onChange={setTab} />
            </View>
            {deliveries.loading ? (
              <T size={14} lh={20 / 14} color={colors.inkMuted} style={{ textAlign: 'center', marginTop: 16 }}>
                Loading bills…
              </T>
            ) : null}
            {!deliveries.loading && isEmpty ? (
              <View style={{ paddingHorizontal: 20 }}>
                <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: r }) => (
          <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            {r.kind === 'queued' ? <WaitingCard item={r.item} /> : <SentCard delivery={r.delivery} onViewPhoto={setViewerSrc} />}
          </View>
        )}
        ListFooterComponent={
          !isEmpty ? (
            <T size={11.5} lh={1.625} color={colors.inkFaint} style={{ textAlign: 'center', marginTop: 8 }}>
              The office team checks each bill against its purchase order.
            </T>
          ) : null
        }
      />
      <PhotoViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, padding: 12 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.warningBg,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.cameraBg,
    overflow: 'hidden',
    ...ring(1, 'rgba(255,255,255,0.7)'),
  },
})
