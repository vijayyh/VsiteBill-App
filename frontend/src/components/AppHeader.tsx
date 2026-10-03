import { Link } from 'react-router-dom'
import { IconBell } from './icons'
import { greeting } from '../lib/format'
import { useUnreadCount } from '../lib/notifications'
import { useSession } from '../lib/session'

const ROLE_LABEL = { supervisor: 'Site supervisor', accountant: 'Office · bill review', admin: 'Admin' } as const

/** Round bell button linking to the role's Alerts tab, with the unread count. */
export function BellButton() {
  const { user } = useSession()
  const unread = useUnreadCount()
  if (!user) return null
  return (
    <Link
      to={`/${user.role}/alerts`}
      aria-label={unread ? `${unread} unread alerts` : 'Alerts'}
      className="relative w-11 h-11 rounded-full glass-strong flex items-center justify-center flex-shrink-0"
    >
      <IconBell size={19} stroke="var(--color-ink)" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#d64545] text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}

/** Greeting header used on each role's home tab: avatar, name, and a bell with the unread count. */
export function AppHeader() {
  const { user } = useSession()
  if (!user) return null

  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-6 pb-3">
      <Link
        to={`/${user.role}/profile`}
        aria-label="Your profile"
        className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2f5f8a] to-accent text-white flex items-center justify-center text-[14px] font-bold flex-shrink-0 ring-2 ring-white/80 shadow-soft"
      >
        {user.initials}
      </Link>
      <div className="flex-grow min-w-0">
        <div className="text-[12px] text-ink-muted">{greeting()},</div>
        <div className="text-[18px] font-bold leading-tight truncate">{user.name}</div>
        <div className="text-[11px] text-ink-faint">{ROLE_LABEL[user.role]}</div>
      </div>
      <BellButton />
    </div>
  )
}
