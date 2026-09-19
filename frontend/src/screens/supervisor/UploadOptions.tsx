import { useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { IconCamera, IconGallery } from '../../components/icons'
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

  return (
    <div className="relative flex flex-col flex-grow overflow-hidden text-ink">
      <div className="flex-shrink-0 flex items-center gap-2.5 px-2 h-14 bg-surface border-b border-border opacity-40">
        <div className="w-10 h-10" />
        <div>
          <div className="text-[15.5px] font-bold leading-tight">{project?.code}</div>
          <div className="text-[11.5px] text-ink-muted">{project?.name}</div>
        </div>
      </div>
      <div className="flex-grow opacity-40 bg-bg" />

      <div className="absolute inset-0 bg-ink/40" />

      <div className="absolute left-0 right-0 bottom-0 bg-surface rounded-t-sheet px-5 pt-2.5 pb-[30px] shadow-[0_-4px_20px_rgba(20,24,26,0.12)]">
        <div className="w-9 h-1 rounded-full bg-border-strong mx-auto mb-[18px]" />
        <div className="text-base font-bold mb-1">Add delivery photo</div>
        <div className="text-[12.5px] text-ink-muted mb-5">Choose how you want to add the challan</div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => cameraInput.current?.click()}
            className="flex items-center gap-3.5 p-4 rounded-card border border-border-strong bg-surface text-left"
          >
            <div className="w-11 h-11 rounded-btn bg-accent flex items-center justify-center flex-shrink-0">
              <IconCamera size={20} stroke="#FFFFFF" />
            </div>
            <div className="flex-grow">
              <div className="text-[14.5px] font-bold">Click photo</div>
              <div className="text-xs text-ink-muted mt-px">Opens your camera directly</div>
            </div>
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
            className="flex items-center gap-3.5 p-4 rounded-card border border-border-strong bg-surface text-left"
          >
            <div className="w-11 h-11 rounded-btn bg-surface-alt flex items-center justify-center flex-shrink-0">
              <IconGallery size={20} stroke="var(--color-ink)" />
            </div>
            <div className="flex-grow">
              <div className="text-[14.5px] font-bold">Upload from gallery</div>
              <div className="text-xs text-ink-muted mt-px">Choose an existing photo</div>
            </div>
          </button>
          <input
            ref={galleryInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFilePicked}
          />
        </div>

        <Link
          to={`/supervisor/projects/${projectId}`}
          className="block text-center mt-4 py-3 text-sm font-semibold text-ink-muted"
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}
