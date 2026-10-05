import { useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ProjectHero } from '../../components/ProjectHero'
import { IconCamera, IconChevronRight, IconGallery } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import type { Project } from '../../lib/types'

export function UploadOptions() {
  const { projectId = '' } = useParams()
  const { data: projectData, error: projectError } = useApiGet<{ project: Project }>(
    `/api/projects/${projectId}`,
  )
  const navigate = useNavigate()
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    navigate(`/supervisor/projects/${projectId}/details`, { state: { file } })
  }

  if (projectError) return <Navigate to="/supervisor" replace />
  const project = projectData?.project
  const projectPath = `/supervisor/projects/${projectId}`

  return (
    <div className="relative flex flex-col flex-grow text-ink">
      {/* The project screen, dimmed behind the sheet. */}
      <div aria-hidden className="pointer-events-none">
        <ProjectHero backTo={projectPath} code={project?.code} name={project?.name} accent={project?.accent} />
      </div>

      <Link
        to={projectPath}
        aria-label="Cancel"
        className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]"
      />

      <div className="fixed bottom-0 sm:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-3 pb-[calc(0.75rem+var(--safe-bottom))] z-20">
        <div className="glass-strong rounded-[28px] px-5 pt-2.5 pb-4">
          <div className="w-10 h-1 rounded-full bg-ink/15 mx-auto mb-5" />
          <div className="text-[18px] font-bold">Add a bill</div>
          <div className="text-[12.5px] text-ink-muted mt-1 mb-5">
            Photograph the bill{project ? ` for ${project.code}` : ''}, or pick a photo you've already taken.
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => cameraInput.current?.click()}
              className="flex items-center gap-3.5 p-3.5 rounded-card bg-gradient-to-br from-[#2f5f8a] to-accent text-white text-left shadow-[0_12px_24px_-14px_rgba(26,60,94,0.9)]"
            >
              <span className="w-12 h-12 rounded-full bg-white/20 ring-1 ring-white/40 flex items-center justify-center flex-shrink-0">
                <IconCamera size={22} stroke="#FFFFFF" />
              </span>
              <span className="flex-grow">
                <span className="block text-[15px] font-bold">Take a photo</span>
                <span className="block text-[12px] opacity-80 mt-px">Opens the phone's camera</span>
              </span>
              <IconChevronRight size={18} stroke="#FFFFFF" />
            </button>
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFilePicked}
            />

            <button
              onClick={() => galleryInput.current?.click()}
              className="flex items-center gap-3.5 p-3.5 rounded-card glass text-left"
            >
              <span className="w-12 h-12 rounded-full bg-white/80 ring-1 ring-white flex items-center justify-center flex-shrink-0">
                <IconGallery size={21} stroke="var(--color-accent)" />
              </span>
              <span className="flex-grow">
                <span className="block text-[15px] font-bold">Choose from gallery</span>
                <span className="block text-[12px] text-ink-muted mt-px">Use a photo already on this phone</span>
              </span>
              <IconChevronRight size={18} stroke="var(--color-ink-faint)" />
            </button>
            <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />
          </div>

          <Link to={projectPath} className="block text-center mt-3 py-3 text-[14px] font-semibold text-ink-muted">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
