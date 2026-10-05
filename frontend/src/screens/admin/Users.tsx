import { useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { api, ApiError, useApiGet } from '../../lib/api'
import type { AdminUser } from '../../lib/types'
import { useSession, type Role } from '../../lib/session'

const roleLabel: Record<Role, string> = {
  supervisor: 'Supervisor',
  accountant: 'Accountant',
  admin: 'Admin',
}

/** "Reset password" with a confirm tap, then the new temporary password to relay. */
function ResetPassword({ user }: { user: AdminUser }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function reset() {
    setStep('busy')
    setError(null)
    try {
      const res = await api.post<{ temporaryPassword: string }>(`/api/admin/users/${user.id}/reset-password`)
      setPassword(res.temporaryPassword)
      setStep('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password')
      setStep('idle')
    }
  }

  if (step === 'done') {
    return (
      <div className="mt-2.5 bg-success-bg/90 ring-1 ring-success-border rounded-[12px] px-3 py-2">
        <div className="text-[11px] text-success-text font-semibold">New password — relay this to {user.name}:</div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-[15px] font-bold text-success-text tracking-wide select-all">{password}</span>
          <button onClick={() => setStep('idle')} className="text-[12px] font-bold text-success-text bg-white/70 rounded-full px-3 py-1">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2.5 flex items-center gap-2">
      {step === 'idle' ? (
        <button onClick={() => setStep('confirm')} className="text-[12px] font-bold text-accent bg-info-bg rounded-full px-3 py-1.5">
          Reset password
        </button>
      ) : (
        <>
          <span className="text-[12px] text-ink-muted">Their current password will stop working.</span>
          <button onClick={() => setStep('idle')} className="text-[12px] font-semibold text-ink-muted px-2 py-1.5">
            Cancel
          </button>
          <button
            onClick={reset}
            disabled={step === 'busy'}
            className="text-[12px] font-bold text-white bg-accent rounded-full px-3 py-1.5 disabled:opacity-60"
          >
            {step === 'busy' ? 'Resetting…' : 'Reset'}
          </button>
        </>
      )}
      {error && <span className="text-[12px] font-semibold text-warning-text">{error}</span>}
    </div>
  )
}

export function AdminUsers() {
  const { user: me } = useSession()
  const { data, refetch } = useApiGet<{ users: AdminUser[] }>('/api/admin/users')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+91 ')
  const [role, setRole] = useState<Role>('supervisor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; phone: string; password: string } | null>(null)

  const users = data?.users ?? []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<{ user: AdminUser; temporaryPassword: string }>('/api/admin/users', {
        name,
        phone,
        role,
      })
      setCreated({ name: res.user.name, phone: res.user.phone, password: res.temporaryPassword })
      setName('')
      setPhone('+91 ')
      setRole('supervisor')
      setShowForm(false)
      refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell title="Users">
      {created && (
        <div className="bg-success-bg/90 ring-1 ring-success-border rounded-card p-3.5 mb-4">
          <div className="text-[13px] font-bold text-success-text">{created.name} was created</div>
          <div className="text-xs text-success-text mt-1">
            Phone: {created.phone}
            <br />
            Temporary password: <span className="font-bold tracking-wide">{created.password}</span>
          </div>
          <div className="text-[11px] text-success-text mt-1.5">
            Relay these to them directly — this won't be shown again.
          </div>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-full glass text-ink text-sm font-semibold mb-4"
        >
          + Add user
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="glass rounded-card p-4 mb-4 flex flex-col gap-3">
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1 block" htmlFor="new-name">
              Name
            </label>
            <input
              id="new-name"
              required
              className="w-full rounded-[14px] glass-strong px-3.5 py-2.5 text-[13.5px] outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1 block" htmlFor="new-phone">
              Phone number
            </label>
            <input
              id="new-phone"
              required
              className="w-full rounded-[14px] glass-strong px-3.5 py-2.5 text-[13.5px] outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1 block" htmlFor="new-role">
              Role
            </label>
            <select
              id="new-role"
              className="w-full rounded-[14px] glass-strong px-3.5 py-2.5 text-[13.5px] outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="supervisor">Supervisor</option>
              <option value="accountant">Accountant</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <div className="text-[12px] font-semibold text-warning-text">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-grow py-2.5 rounded-full glass text-ink text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-grow py-2.5 rounded-full bg-accent text-white text-[13px] font-bold shadow-soft disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2.5">
        {users.map((u) => (
          <div key={u.id} className="glass rounded-card p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2f5f8a] to-accent ring-2 ring-white/80 flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0">
                {u.initials}
              </div>
              <div className="flex-grow min-w-0">
                <div className="text-[13.5px] font-bold truncate">{u.name}</div>
                <div className="text-xs text-ink-muted mt-px">{u.phone}</div>
                {u.role !== 'admin' && (
                  <div className="text-[11px] text-ink-faint mt-px">
                    {u.deliveryCount} bill{u.deliveryCount === 1 ? '' : 's'} across {u.projectsUploadedTo}{' '}
                    project{u.projectsUploadedTo === 1 ? '' : 's'}
                  </div>
                )}
              </div>
              <div className="text-[10.5px] font-bold rounded-full px-2.5 py-1 bg-white/75 ring-1 ring-white text-ink-muted whitespace-nowrap">
                {roleLabel[u.role]}
              </div>
            </div>
            {/* Your own password is changed from Profile, which asks for the current one. */}
            {u.id !== me?.id && <ResetPassword user={u} />}
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
