import { RefreshControl, ScrollView, View } from 'react-native'
import { useTabBarSpace } from '../../../components/BottomNav'
import { ProjectCard } from '../../../components/projects'
import { Screen } from '../../../components/Screen'
import { T } from '../../../components/T'
import { PageTitle } from '../../../components/ui'
import { useApiGet } from '../../../lib/api'
import { colors } from '../../../lib/theme'
import type { Project } from '../../../lib/types'

/** The camera button: pick which project the delivery is for, then take or choose the photo. */
export default function AddBill() {
  const space = useTabBarSpace()
  const { data, loading, error, refresh, refreshing } = useApiGet<{ projects: Project[] }>('/api/projects')

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
      >
        <PageTitle title="Add a bill" subtitle="Which project is this delivery for?" />
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
          {data?.projects.map((project) => (
            <ProjectCard
              key={project.id}
              to={`/supervisor/projects/${project.id}/upload`}
              code={project.code}
              name={project.name}
              accent={project.accent}
              footer={
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T size={12.5} color={colors.inkMuted}>
                    Photograph the bill for this site
                  </T>
                  <T size={12.5} weight={700} color={colors.accent}>
                    Choose →
                  </T>
                </View>
              }
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}
