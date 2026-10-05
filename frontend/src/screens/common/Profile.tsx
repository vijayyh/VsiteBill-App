import { useState, type ComponentType, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TabScreen } from '../../components/BottomNav'
import { Card, Field, PageTitle, btnPrimary } from '../../components/ui'
import { IconCheck, IconChevronRight, IconClock, IconInfo, IconLock, IconLogOut, IconPhone } from '../../components/icons'
import { api, ApiError, useApiGet } from '../../lib/api'
import { useQueuedUploads } from '../../lib/offlineQueue'
import { useSession } from '../../lib/session'

type Icon = ComponentType<{ size?: number; stroke?: string; strokeWidth?: number }>

const ROLE_LABEL = { supervisor: 'Site supervisor', accountant: 'Office / accountant', admin: 'Admin' } as const

function Row({ icon: Icon, label, value, onClick, danger = false, chevron = false }: {
  icon: Icon
  label: string
  value?: ReactNode
  onClick?: () => void
  danger?: boolean
  chevron?: boolean
}) {
  const content = (
    <>
      <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-white/80 ${danger ? 'bg-[#fbe9e9]' : 'bg-white/70'}`}>
        <Icon size={17} stroke={danger ? '#c23b3b' : 'var(--color-accent)'} />
      </span>
      <span className={`flex-grow text-left text-[14px] font-semibold ${danger ? 'text-[#c23b3b]' : ''}`}>{label}</span>
      {value && <span className="text-[12.5px] text-ink-muted">{value}</span>}
      {chevron && <IconChevronRight size={16} stroke="var(--color-ink-faint)" />}
    </>
  )
  const className = 'w-full flex items-center gap-3 px-4 py-3'
  return onClick ? (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next !== confirm) {
      setError('The two new passwords don’t match')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the password. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="px-4 pb-4 flex flex-col gap-3">
      <Field id="cur" label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      <Field id="new" label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" hint="At least 8 characters" />
      <Field id="confirm" label="Repeat new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      {error && <div className="text-[12.5px] font-semibold text-warning-text ml-3">{error}</div>}
      <button type="submit" disabled={busy || !current || !next || !confirm} className={`${btnPrimary} py-3 text-[14px]`}>
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  )
}

export function Profile() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const { data } = useApiGet<{ user: { phone: string } }>('/api/auth/me')
  const queued = useQueuedUploads()
  const [changing, setChanging] = useState(false)
  const [changed, setChanged] = useState(false)

  if (!user) return null

  return (
    <TabScreen>
      <PageTitle title="Profile" />

      <div className="px-5 flex flex-col gap-4">
        <Card className="p-5 flex items-center gap-4">
          <span className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2f5f8a] to-accent text-white flex items-center justify-center text-[22px] font-bold ring-4 ring-white/80 shadow-soft">
            {user.initials}
          </span>
          <div className="min-w-0">
            <div className="text-[18px] font-bold truncate">{user.name}</div>
            <div className="text-[12.5px] text-ink-muted">{ROLE_LABEL[user.role]}</div>
          </div>
        </Card>

        <Card className="divide-y divide-white/70 overflow-hidden">
          <Row icon={IconPhone} label="Phone" value={data?.user.phone ?? '…'} />
          {user.role === 'supervisor' && (
            <Row icon={IconClock} label="Bills waiting for signal" value={queued.length} />
          )}
        </Card>

        <div>
          <div className="text-[12px] font-bold text-ink-muted uppercase tracking-wide mb-2 ml-1">Security</div>
          <Card className="overflow-hidden">
            <Row
              icon={changed ? IconCheck : IconLock}
              label={changed ? 'Password changed' : 'Change password'}
              onClick={() => {
                setChanging((v) => !v)
                setChanged(false)
              }}
              chevron={!changing}
            />
            {changing && (
              <ChangePassword
                onDone={() => {
                  setChanging(false)
                  setChanged(true)
                }}
              />
            )}
          </Card>
          <div className="text-[11.5px] text-ink-muted mt-2 ml-1 leading-snug">
            Forgot it? Log out and use “Forgot password?” — an admin will set a new one for you.
          </div>
        </div>

        <div>
          <div className="text-[12px] font-bold text-ink-muted uppercase tracking-wide mb-2 ml-1">About</div>
          <Card className="divide-y divide-white/70 overflow-hidden">
            <Row icon={IconInfo} label="SiteVerify" value={`Updated ${__APP_BUILD_DATE__}`} />
          </Card>
        </div>

        <Card className="overflow-hidden">
          <Row
            icon={IconLogOut}
            label="Log out"
            danger
            onClick={() => {
              logout()
              navigate('/login')
            }}
          />
        </Card>
      </div>
    </TabScreen>
  )
}
