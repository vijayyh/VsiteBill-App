import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native'
import { BillRow } from '../../../components/bills'
import { useTabBarSpace } from '../../../components/BottomNav'
import { AppHeader } from '../../../components/headers'
import { IconAlertTriangle, IconBill, IconCheck, IconClock } from '../../../components/icons'
import { ProjectCard } from '../../../components/projects'
import { Screen } from '../../../components/Screen'
import { T } from '../../../components/T'
import { EmptyState, SectionTitle, StatTile } from '../../../components/ui'
import { useApiGet } from '../../../lib/api'
import { useQueuedUploads } from '../../../lib/offlineQueue'
import { colors } from '../../../lib/theme'
import type { AdminDelivery, Project } from '../../../lib/types'

// Same as the web app's supervisor Home (frontend/src/screens/supervisor/Dashboard.tsx).
export default function SupervisorHome() {
  const space = useTabBarSpace()
  const { width } = useWindowDimensions()
  const projects = useApiGet<{ projects: Project[] }>('/api/projects')
  const billsQuery = useApiGet<{ deliveries: AdminDelivery[] }>('/api/deliveries')
  const queued = useQueuedUploads()

  const bills = billsQuery.data?.deliveries ?? []
  const today = new Date().toDateString()
  const sentToday = bills.filter((b) => new Date(b.uploadedAt).toDateString() === today).length
  const flagged = bills.filter((b) => b.status === 'REVIEW').length
  const countFor = (projectId: string) => bills.filter((b) => b.projectId === projectId).length
  // The web's w-[78%] is 78% of the row inside its 20 px side padding.
  const cardWidth = Math.round((width - 40) * 0.78)

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space }}
        refreshControl={
          <RefreshControl
            refreshing={projects.refreshing || billsQuery.refreshing}
            onRefresh={() => {
              projects.refresh()
              billsQuery.refresh()
            }}
            colors={[colors.accent]}
          />
        }
      >
        <AppHeader />

        <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 10 }}>
          <StatTile value={sentToday} label="Sent today" icon={IconCheck} tint={{ bg: colors.successBg, fg: colors.successText }} />
          <StatTile value={queued.length} label="Waiting for signal" icon={IconClock} tint={{ bg: colors.warningBg, fg: colors.warningText }} />
          <StatTile value={flagged} label="Flagged by office" icon={IconAlertTriangle} tint={{ bg: colors.infoBg, fg: colors.infoText }} />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <SectionTitle title="Your projects" />
          {projects.loading ? (
            <T size={14} lh={20 / 14} color={colors.inkMuted}>
              Loading projects…
            </T>
          ) : null}
          {projects.error ? (
            <T size={14} lh={20 / 14} color={colors.warningText}>
              {projects.error}
            </T>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 8 }}
        >
          {projects.data?.projects.map((project) => (
            <ProjectCard
              key={project.id}
              to={`/supervisor/projects/${project.id}`}
              code={project.code}
              name={project.name}
              accent={project.accent}
              style={{ width: cardWidth }}
              footer={
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T size={12} color={colors.inkMuted}>
                    <T size={12} weight={700}>
                      {countFor(project.id)}
                    </T>{' '}
                    bills from you
                  </T>
                  <T size={12} weight={700} color={colors.accent}>
                    Open →
                  </T>
                </View>
              }
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <SectionTitle title="Recent bills" to="/supervisor/bills" />
          {bills.length === 0 ? (
            <EmptyState icon={IconBill} title="No bills yet" body="Bills you send will appear here. Tap the camera button to add your first one." />
          ) : (
            <View style={{ gap: 10 }}>
              {bills.slice(0, 4).map((bill) => (
                <BillRow key={bill.id} bill={bill} to={`/supervisor/projects/${bill.projectId}`} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}
