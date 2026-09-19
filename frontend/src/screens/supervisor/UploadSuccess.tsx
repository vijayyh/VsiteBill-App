import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { IconCheck, IconClock } from '../../components/icons'
import { useApiGet } from '../../lib/api'
import type { Project } from '../../lib/types'

export function UploadSuccess() {
  const { projectId = '' } = useParams()
  const location = useLocation()
  const queued = (location.state as { queued?: boolean } | null)?.queued === true

  const { data, error } = useApiGet<{ project: Project }>(`/api/projects/${projectId}`)
  if (error) return <Navigate to="/supervisor" replace />
  const project = data?.project

  return (
    <div className="flex flex-col flex-grow text-ink">
      <div className="flex-grow flex flex-col items-center justify-center px-8 text-center">
        <div
          className={`w-[84px] h-[84px] rounded-full flex items-center justify-center mb-6 ${
            queued ? 'bg-warning-bg' : 'bg-success-bg'
          }`}
        >
          {queued ? (
            <IconClock size={36} stroke="var(--color-warning-text)" strokeWidth={2.5} />
          ) : (
            <IconCheck size={38} stroke="var(--color-success-text)" strokeWidth={2.5} />
          )}
        </div>

        <div className="text-xl font-bold mb-2">
          {queued ? 'Saved on this device' : 'Delivery photo uploaded'}
        </div>
        <div className="text-[13.5px] text-ink-muted leading-relaxed mb-[26px]">
          {queued ? (
            <>
              No signal right now — this will send to {project?.code} automatically the moment you're back online.
            </>
          ) : (
            <>
              Saved to {project?.code} &middot; {project?.name}
              <br />
              Today, {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </>
          )}
        </div>

        <div className="w-full bg-surface border border-border rounded-card px-4 py-[13px] text-xs text-ink-muted leading-relaxed">
          {queued
            ? "You don't need to do anything else — keep the app open or come back later and it'll finish sending on its own once you have signal."
            : 'The office team will review this against the purchase order. No further action needed from you right now.'}
        </div>
      </div>

      <div className="flex-shrink-0 px-5 pt-3.5 pb-[30px] flex flex-col gap-2.5">
        <Link
          to={`/supervisor/projects/${projectId}`}
          className="block w-full text-center py-4 rounded-btn bg-accent text-white text-[15px] font-bold"
        >
          Back to project
        </Link>
        <Link
          to={`/supervisor/projects/${projectId}/upload`}
          className="block w-full text-center py-3.5 rounded-btn border border-border-strong text-ink text-sm font-semibold"
        >
          Add another delivery
        </Link>
      </div>
    </div>
  )
}
