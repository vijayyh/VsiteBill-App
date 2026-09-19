import { useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { IconAlertTriangle } from '../../components/icons'
import { api, useApiGet } from '../../lib/api'
import type { AdminOverview, PasswordResetRequest } from '../../lib/types'

export function AdminDashboard() {
  const { data: overview, refetch: refetchOverview } = useApiGet<AdminOverview>('/api/admin/overview')
  const {
    data: resetsData,
    refetch: refetchResets,
  } = useApiGet<{ requests: PasswordResetRequest[] }>('/api/admin/password-resets')
  const [resolving, setResolving] = useState<number | null>(null)
  const [resolvedPasswords, setResolvedPasswords] = useState<Record<number, string>>({})

  const pending = resetsData?.requests ?? []

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
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="bg-surface border border-border rounded-card p-3.5">
          <div className="text-xl font-bold">
            {(overview?.userCounts.supervisor ?? 0) + (overview?.userCounts.accountant ?? 0)}
          </div>
          <div className="text-[11px] text-ink-muted mt-0.5">
            Users ({overview?.userCounts.supervisor ?? 0} supervisor, {overview?.userCounts.accountant ?? 0}{' '}
            accountant)
          </div>
        </div>
        <div className="bg-surface border border-border rounded-card p-3.5">
          <div className="text-xl font-bold">{overview?.projectCount ?? '–'}</div>
          <div className="text-[11px] text-ink-muted mt-0.5">Projects</div>
        </div>
        <div className="bg-surface border border-border rounded-card p-3.5">
          <div className="text-xl font-bold">{overview?.deliveryCount ?? '–'}</div>
          <div className="text-[11px] text-ink-muted mt-0.5">Deliveries logged</div>
        </div>
        <div className="bg-warning-bg border border-warning-border rounded-card p-3.5">
          <div className="text-xl font-bold text-warning-text">{overview?.pendingPasswordResets ?? 0}</div>
          <div className="text-[11px] text-warning-text mt-0.5">Password resets pending</div>
        </div>
      </div>

      <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2.5">Notifications</div>

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
