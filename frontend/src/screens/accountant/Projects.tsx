import { TabScreen } from '../../components/BottomNav'
import { ProjectCard } from '../../components/ProjectCard'
import { ProjectCounts } from '../../components/ProjectCounts'
import { PageTitle } from '../../components/ui'
import { useApiGet } from '../../lib/api'
import type { OfficeDrive, ProjectSummary } from '../../lib/types'

export function AccountantProjects() {
  const { data, loading, error } = useApiGet<{ projects: ProjectSummary[] }>('/api/projects')
  const { data: drive } = useApiGet<OfficeDrive>('/api/office/drive')

  return (
    <TabScreen>
      <PageTitle title="Projects" subtitle="Open a project to see every bill, or its Drive folder" />
      <div className="px-5 flex flex-col gap-3">
        {loading && <div className="text-sm text-ink-muted">Loading projects…</div>}
        {error && <div className="text-sm text-warning-text">{error}</div>}
        {data?.projects.map((project) => {
          const folder = drive?.projectFolderUrls?.[project.id]
          return (
            <div key={project.id} className="relative">
              <ProjectCard
                to={`/accountant/projects/${project.id}/gallery`}
                code={project.code}
                name={project.name}
                accent={project.accent}
                footer={<ProjectCounts project={project} />}
              />
              {folder && (
                <a
                  href={folder}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute top-3.5 right-3.5 rounded-full bg-white/20 ring-1 ring-white/40 text-white text-[11.5px] font-bold px-2.5 py-1 backdrop-blur"
                >
                  Drive ↗
                </a>
              )}
            </div>
          )
        })}
      </div>
    </TabScreen>
  )
}
