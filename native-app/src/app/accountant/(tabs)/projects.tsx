import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useTabBarSpace } from '../../../components/BottomNav'
import { Frost, FrostBackdrop, FrostScope } from '../../../components/Frost'
import { ProjectCard, ProjectCounts } from '../../../components/projects'
import { Screen } from '../../../components/Screen'
import { T } from '../../../components/T'
import { PageTitle, Tap } from '../../../components/ui'
import { useApiGet } from '../../../lib/api'
import { colors, ring } from '../../../lib/theme'
import type { OfficeDrive, ProjectSummary } from '../../../lib/types'

// Same as the web app's accountant Projects tab (frontend/src/screens/accountant/Projects.tsx).
export default function AccountantProjects() {
  const space = useTabBarSpace()
  const { data, loading, error, refresh, refreshing } = useApiGet<{ projects: ProjectSummary[] }>('/api/projects')
  const { data: drive } = useApiGet<OfficeDrive>('/api/office/drive')

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
      >
        <PageTitle title="Projects" subtitle="Open a project to see every bill, or its Drive folder" />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {loading ? (
            <T size={14} lh={20 / 14} color={colors.inkMuted}>
              Loading projects…
            </T>
          ) : null}
          {error ? (
            <T size={14} lh={20 / 14} color={colors.warningText}>
              {error}
            </T>
          ) : null}
          {data?.projects.map((project) => {
            const folder = drive?.projectFolderUrls?.[project.id]
            return (
              // The card is the backdrop the frosted Drive pill blurs.
              <FrostScope key={project.id}>
                <View>
                  <FrostBackdrop>
                    <ProjectCard
                      to={`/accountant/projects/${project.id}/gallery`}
                      code={project.code}
                      name={project.name}
                      accent={project.accent}
                      footer={<ProjectCounts project={project} />}
                    />
                  </FrostBackdrop>
                  {folder ? (
                    <Tap onPress={() => void Linking.openURL(folder)} style={styles.drive}>
                      <Frost blur={8} tint="rgba(255, 255, 255, 0.2)" style={{ borderRadius: 999 }} />
                      <T size={11.5} weight={700} color={colors.white}>
                        Drive ↗
                      </T>
                    </Tap>
                  ) : null}
                </View>
              </FrostScope>
            )
          })}
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  drive: {
    position: 'absolute',
    top: 14,
    right: 14,
    borderRadius: 999,
    ...ring(1, 'rgba(255,255,255,0.4)'),
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
})
