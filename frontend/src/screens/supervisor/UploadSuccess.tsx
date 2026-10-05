import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Card, btnPrimary, btnSecondary } from '../../components/ui'
import { IconCamera, IconCheck, IconClock } from '../../components/icons'
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
      <div className="flex-grow flex flex-col items-center justify-center px-6 pt-10 pb-4 text-center">
        <div
          className={`w-[104px] h-[104px] rounded-full flex items-center justify-center mb-6 ring-[10px] shadow-soft ${
            queued ? 'bg-warning-bg ring-warning-bg/50' : 'bg-success-bg ring-success-bg/50'
          }`}
        >
          {queued ? (
            <IconClock size={44} stroke="var(--color-warning-text)" strokeWidth={2.4} />
          ) : (
            <IconCheck size={48} stroke="var(--color-success-text)" strokeWidth={2.6} />
          )}
        </div>

        <div className="text-[24px] font-bold leading-tight">
          {queued ? 'Saved on this phone' : 'Bill sent to the office'}
        </div>
        <div className="text-[13.5px] text-ink-muted leading-relaxed mt-2 mb-6 max-w-[300px]">
          {queued
            ? `No signal right now. It will send to ${project?.code ?? 'the office'} by itself as soon as you're back online.`
            : 'The office team will check it against the purchase order. Nothing more needed from you.'}
        </div>

        <Card className="w-full p-4 text-left flex items-center gap-3">
          <span
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              queued ? 'bg-warning-bg' : 'bg-success-bg'
            }`}
          >
            {queued ? (
              <IconClock size={18} stroke="var(--color-warning-text)" strokeWidth={2.4} />
            ) : (
              <IconCheck size={18} stroke="var(--color-success-text)" strokeWidth={2.6} />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold truncate">
              {project ? `${project.code} · ${project.name}` : '…'}
            </div>
            <div className="text-[12px] text-ink-muted mt-0.5">
              {queued
                ? 'Waiting for signal · keep the app open or come back later'
                : `Sent today, ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex-shrink-0 px-5 pt-2 pb-8 flex flex-col gap-2.5">
        <Link to={`/supervisor/projects/${projectId}`} className={`${btnPrimary} w-full py-4 text-[15px]`}>
          Back to project
        </Link>
        <Link to={`/supervisor/projects/${projectId}/upload`} className={`${btnSecondary} w-full py-3.5 text-[14px]`}>
          <IconCamera size={18} stroke="var(--color-ink)" />
          Add another bill
        </Link>
      </div>
    </div>
  )
}
