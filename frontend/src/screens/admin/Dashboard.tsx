import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminShell } from '../../components/AdminShell'
import { IconAlertTriangle, IconCheck } from '../../components/icons'
import { api, useApiGet } from '../../lib/api'
import type { AdminOverview, DriveStatus, PasswordResetRequest, SharedDrive } from '../../lib/types'

export function AdminDashboard() {
  const { data: overview, refetch: refetchOverview } = useApiGet<AdminOverview>('/api/admin/overview')
  const {
    data: resetsData,
    refetch: refetchResets,
  } = useApiGet<{ requests: PasswordResetRequest[] }>('/api/admin/password-resets')
  const { data: driveStatus, refetch: refetchDrive } = useApiGet<DriveStatus>('/api/admin/drive/status')
  const { data: sharedDrivesData } = useApiGet<{ sharedDrives: SharedDrive[] }>(
    driveStatus?.connected ? '/api/admin/drive/shared-drives' : null,
  )
  const [resolving, setResolving] = useState<number | null>(null)
  const [resolvedPasswords, setResolvedPasswords] = useState<Record<number, string>>({})
  const [connecting, setConnecting] = useState(false)
  const [settingDrive, setSettingDrive] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const drive = searchParams.get('drive')
    if (!drive) return
    if (drive === 'error') setDriveError('Could not connect that Google account. Try again.')
    refetchDrive()
    setSearchParams({}, { replace: true })
  }, [searchParams])

  const pending = resetsData?.requests ?? []

  async function connectDrive() {
    setConnecting(true)
    setDriveError(null)
    try {
      const res = await api.get<{ authUrl: string }>('/api/admin/drive/connect')
      window.location.href = res.authUrl
    } catch {
      setDriveError('Could not start the Google connection. Try again.')
      setConnecting(false)
    }
  }

  async function disconnectDrive() {
    await api.post('/api/admin/drive/disconnect')
    refetchDrive()
  }

  async function chooseSharedDrive(id: string) {
    setSettingDrive(true)
    setDriveError(null)
    try {
      const selected = sharedDrivesData?.sharedDrives.find((d) => d.id === id)
      await api.post('/api/admin/drive/shared-drive', { id: id || null, name: selected?.name ?? null })
      refetchDrive()
    } catch {
      setDriveError('Could not switch the Drive location. Try again.')
    } finally {
      setSettingDrive(false)
    }
  }

  async function resolve(requestId: number) {
    setResolving(requestId)
    try {
      const res = await api.post<{ temporaryPassword: string }>(
        `/api/admin/password-resets/${requestId}/resolve`,
      )
      setResolvedPasswords((prev) => ({ ...prev, [requestId]: res.temporaryPassword }))
      refetchOverview()
      refetchResets()
    } finally {
      setResolving(null)
    }
  }

  return (
    <AdminShell title="Overview">
      <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2.5">Google Drive</div>
      <div className="bg-surface border border-border rounded-card p-3.5 mb-5">
        {driveError && <div className="text-[12px] font-semibold text-warning-text mb-2">{driveError}</div>}

        {!driveStatus?.configured && (
          <div className="text-[13px] text-ink-muted">
            Not set up yet — Google API credentials need to be added on the server first.
          </div>
        )}

        {driveStatus?.configured && driveStatus.connected && driveStatus.account && (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-success-bg flex items-center justify-center flex-shrink-0">
              <IconCheck size={16} stroke="var(--color-success-text)" strokeWidth={2.5} />
            </div>
            <div className="flex-grow">
              <div className="text-[13.5px] font-bold">Connected as {driveStatus.account.email}</div>
              <div className="text-xs text-ink-muted mt-0.5">
                Connected by {driveStatus.account.connectedBy}
              </div>

              <label className="text-[11px] font-semibold text-label mt-2.5 mb-1 block">
                Save bill photos to
              </label>
              <select
                className="w-full rounded-field border border-border-strong px-2.5 py-2 text-[12.5px] bg-surface"
                value={driveStatus.account.sharedDriveId ?? ''}
                disabled={settingDrive}
                onChange={(e) => chooseSharedDrive(e.target.value)}
              >
                <option value="">My Drive (personal — {driveStatus.account.email})</option>
                {sharedDrivesData?.sharedDrives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} (Shared Drive)
                  </option>
                ))}
              </select>

              {driveStatus.account.rootFolderUrl ? (
                <a
                  href={driveStatus.account.rootFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-block text-[12.5px] font-semibold text-accent"
                >
                  Open Drive folder ↗
                </a>
              ) : (
                <div className="mt-2.5 text-xs text-ink-muted">
                  The Drive folder will appear here once it's created.
                </div>
              )}

              <div>
                <button
                  onClick={disconnectDrive}
                  className="mt-2.5 text-[12px] font-semibold text-warning-text"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}

        {driveStatus?.configured && !driveStatus.connected && (
          <div>
            <div className="text-[13px] text-ink-muted mb-2.5">
              Connect a Google account so accountants can save bill photos straight to Drive, organized by
              project.
            </div>
            <button
              onClick={connectDrive}
              disabled={connecting}
              className="text-[12.5px] font-bold text-white bg-accent rounded-btn px-3.5 py-2 disabled:opacity-60"
            >
              {connecting ? 'Connecting…' : 'Connect Google Drive'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <Link to="/admin/users" className="bg-surface border border-border rounded-card p-3.5 text-left">
          <div className="text-xl font-bold">
            {(overview?.userCounts.supervisor ?? 0) + (overview?.userCounts.accountant ?? 0)}
          </div>
          <div className="text-[11px] text-ink-muted mt-0.5">
            Users ({overview?.userCounts.supervisor ?? 0} supervisor, {overview?.userCounts.accountant ?? 0}{' '}
            accountant)
          </div>
        </Link>
        <Link to="/admin/projects" className="bg-surface border border-border rounded-card p-3.5 text-left">
          <div className="text-xl font-bold">{overview?.projectCount ?? '–'}</div>
          <div className="text-[11px] text-ink-muted mt-0.5">Projects</div>
        </Link>
        <Link to="/admin/deliveries" className="bg-surface border border-border rounded-card p-3.5 text-left">
          <div className="text-xl font-bold">{overview?.deliveryCount ?? '–'}</div>
          <div className="text-[11px] text-ink-muted mt-0.5">Deliveries logged</div>
        </Link>
        <button
          onClick={() => document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-warning-bg border border-warning-border rounded-card p-3.5 text-left"
        >
          <div className="text-xl font-bold text-warning-text">{overview?.pendingPasswordResets ?? 0}</div>
          <div className="text-[11px] text-warning-text mt-0.5">Password resets pending</div>
        </button>
      </div>

      <div id="notifications" className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2.5">
        Notifications
      </div>

      {pending.length === 0 && (
        <div className="text-sm text-ink-muted">No pending requests — you're all caught up.</div>
      )}

      <div className="flex flex-col gap-2.5">
        {pending.map((req) => (
          <div key={req.id} className="bg-surface border border-warning-border rounded-card p-3.5">
            <div className="flex items-start gap-2.5">
              <IconAlertTriangle size={16} stroke="var(--color-warning-text)" strokeWidth={2.5} />
              <div className="flex-grow">
                <div className="text-[13.5px] font-bold">
                  {req.user.name} forgot their password
                </div>
                <div className="text-xs text-ink-muted mt-0.5">
                  {req.user.phone} &middot; {req.user.role}
                </div>
                {req.note && <div className="text-xs text-ink-muted mt-1 italic">"{req.note}"</div>}

                {resolvedPasswords[req.id] ? (
                  <div className="mt-2.5 bg-success-bg border border-success-border rounded-lg px-3 py-2">
                    <div className="text-[11px] text-success-text font-semibold">
                      New password — relay this to {req.user.name}:
                    </div>
                    <div className="text-[15px] font-bold text-success-text tracking-wide mt-0.5">
                      {resolvedPasswords[req.id]}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => resolve(req.id)}
                    disabled={resolving === req.id}
                    className="mt-2.5 text-[12.5px] font-bold text-white bg-accent rounded-btn px-3.5 py-2 disabled:opacity-60"
                  >
                    {resolving === req.id ? 'Setting…' : 'Set new password'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
