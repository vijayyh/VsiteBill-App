import { TabScreen } from '../../components/BottomNav'
import { ProjectCard } from '../../components/ProjectCard'
import { PageTitle } from '../../components/ui'
import { useApiGet } from '../../lib/api'
import type { Project } from '../../lib/types'

/** The camera button: pick which project the delivery is for, then take or choose the photo. */
export function AddBill() {
  const { data, loading, error } = useApiGet<{ projects: Project[] }>('/api/projects')

  return (
    <TabScreen>
      <PageTitle title="Add a bill" subtitle="Which project is this delivery for?" />
      <div className="px-5 flex flex-col gap-3">
        {loading && <div className="text-sm text-ink-muted">Loading projects…</div>}
        {error && <div className="text-sm text-warning-text">{error}</div>}
        {data?.projects.map((project) => (
          <ProjectCard
            key={project.id}
            to={`/supervisor/projects/${project.id}/upload`}
            code={project.code}
            name={project.name}
            accent={project.accent}
            footer={
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-ink-muted">Photograph the bill for this site</span>
                <span className="font-bold text-accent">Choose →</span>
              </div>
            }
          />
        ))}
      </div>
    </TabScreen>
  )
}
