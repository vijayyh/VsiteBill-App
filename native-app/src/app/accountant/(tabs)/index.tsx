import { router } from 'expo-router'
import { Linking, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { BillRow } from '../../../components/bills'
import { useTabBarSpace } from '../../../components/BottomNav'
import { AppHeader } from '../../../components/headers'
import { IconAlertTriangle, IconBill, IconCheck, IconClipboardCheck, IconClock, IconCloud } from '../../../components/icons'
import { ProjectCard, ProjectCounts } from '../../../components/projects'
import { Screen } from '../../../components/Screen'
import { T } from '../../../components/T'
import { Card, EmptyState, PrimaryButton, SectionTitle, StatTile, Tap } from '../../../components/ui'
import { useApiGet } from '../../../lib/api'
import { colors, navyGradient, ring } from '../../../lib/theme'
import type { AdminDelivery, OfficeDrive, ProjectSummary } from '../../../lib/types'

// Same as the web app's accountant Home (frontend/src/screens/accountant/Dashboard.tsx).
interface OfficeStats {
  pending: number
  flagged: number
  matchedThisMonth: number
}

function DriveArchiveCard({ drive }: { drive: OfficeDrive | null }) {
  if (!drive) return null
  if (!drive.connected) {
    return (
      <Card style={styles.driveRow}>
        <View style={[styles.driveIcon, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
          <IconCloud size={18} stroke={colors.inkFaint} />
        </View>
        <T size={12.5} lh={1.375} color={colors.inkMuted} style={{ flex: 1 }}>
          Google Drive isn’t connected yet. An admin can connect it from the admin panel.
        </T>
      </Card>
    )
  }
  return (
    <Card style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.driveIcon, { backgroundColor: colors.successBg }]}>
          <IconCloud size={18} stroke={colors.successText} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={13.5} weight={700}>
            Bills archive in Google Drive
          </T>
          <T size={11.5} color={colors.inkMuted} numberOfLines={1}>
            {drive.sharedDriveName ? `Shared Drive: ${drive.sharedDriveName}` : `My Drive of ${drive.email}`}
          </T>
        </View>
        {drive.rootFolderUrl ? (
          <PrimaryButton onPress={() => void Linking.openURL(drive.rootFolderUrl!)} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
            <T size={12} weight={700} color={colors.white}>
              Open ↗
            </T>
          </PrimaryButton>
        ) : null}
      </View>
      <T size={11} lh={1.375} color={colors.inkFaint} style={{ marginTop: 10 }}>
        View-only. If Google asks for access, ask an admin to add your Google account as a Viewer.
      </T>
    </Card>
  )
}

export default function AccountantHome() {
  const space = useTabBarSpace()
  const { width } = useWindowDimensions()
  const projects = useApiGet<{ projects: ProjectSummary[] }>('/api/projects')
  const stats = useApiGet<OfficeStats>('/api/office/stats')
  const drive = useApiGet<OfficeDrive>('/api/office/drive')
  const billsQuery = useApiGet<{ deliveries: AdminDelivery[] }>('/api/deliveries')

  const toReview = (stats.data?.pending ?? 0) + (stats.data?.flagged ?? 0)
  const latest = (billsQuery.data?.deliveries ?? []).slice(0, 4)
  // The web's w-[78%] is 78% of the row inside its 20 px side padding.
  const cardWidth = Math.round((width - 40) * 0.78)
  const refreshAll = () => {
    projects.refresh()
    stats.refetch()
    drive.refetch()
    billsQuery.refetch()
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space }}
        refreshControl={<RefreshControl refreshing={projects.refreshing} onRefresh={refreshAll} colors={[colors.accent]} />}
      >
        <AppHeader />

        <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 10 }}>
          <StatTile value={stats.data?.pending ?? '–'} label="Pending" icon={IconClock} tint={{ bg: colors.infoBg, fg: colors.infoText }} />
          <StatTile value={stats.data?.flagged ?? '–'} label="Flagged" icon={IconAlertTriangle} tint={{ bg: colors.warningBg, fg: colors.warningText }} />
          <StatTile
            value={stats.data?.matchedThisMonth ?? '–'}
            label="Matched this month"
            icon={IconCheck}
            tint={{ bg: colors.successBg, fg: colors.successText }}
          />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <View style={styles.callout}>
            <View style={styles.calloutIcon}>
              <IconClipboardCheck size={20} stroke={colors.white} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={15} weight={700} color={colors.white}>
                {toReview ? `${toReview} bills need review` : 'All caught up'}
              </T>
              <T size={12} color="rgba(255,255,255,0.75)">
                {toReview ? 'Pending and flagged bills, across every project' : 'No pending or flagged bills right now'}
              </T>
            </View>
            {toReview > 0 ? (
              <Tap onPress={() => router.navigate('/accountant/review')} style={styles.calloutButton}>
                <T size={12.5} weight={700} color={colors.accent}>
                  Review
                </T>
              </Tap>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <DriveArchiveCard drive={drive.data} />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <SectionTitle title="Projects" to="/accountant/projects" />
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
              to={`/accountant/projects/${project.id}/gallery`}
              code={project.code}
              name={project.name}
              accent={project.accent}
              style={{ width: cardWidth }}
              footer={<ProjectCounts project={project} />}
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <SectionTitle title="Latest bills" to="/accountant/review" linkLabel="Review queue" />
          {latest.length === 0 ? (
            <EmptyState icon={IconBill} title="No bills yet" body="Bills supervisors send from site will appear here." />
          ) : (
            <View style={{ gap: 10 }}>
              {latest.map((bill) => (
                <BillRow key={bill.id} bill={bill} to={`/accountant/projects/${bill.projectId}/review/${bill.id}`} showUploader />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  driveRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  driveIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...ring(1, colors.white),
  },
  callout: {
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    experimental_backgroundImage: navyGradient,
    ...ring(1, 'rgba(255,255,255,0.3)'),
    boxShadow: '0px 16px 32px -18px rgba(26, 60, 94, 0.9)',
  },
  calloutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    ...ring(1, 'rgba(255,255,255,0.3)'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutButton: { borderRadius: 999, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
})
