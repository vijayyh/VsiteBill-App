import type { ComponentType, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconBell,
  IconBill,
  IconCamera,
  IconClipboardCheck,
  IconFolder,
  IconGrid,
  IconHome,
  IconUser,
  IconUsers,
} from './icons'
import { useSession, type Role } from '../lib/session'
import { useUnreadCount } from '../lib/notifications'

type Icon = ComponentType<{ size?: number; stroke?: string; strokeWidth?: number }>

interface NavItem {
  to: string
  label: string
  icon: Icon
  end?: boolean
  badge?: boolean
}

const NAV: Record<Role, { items: NavItem[]; center?: NavItem }> = {
  supervisor: {
    items: [
      { to: '/supervisor', label: 'Home', icon: IconHome, end: true },
      { to: '/supervisor/bills', label: 'My bills', icon: IconBill },
      { to: '/supervisor/alerts', label: 'Alerts', icon: IconBell, badge: true },
      { to: '/supervisor/profile', label: 'Profile', icon: IconUser },
    ],
    center: { to: '/supervisor/add', label: 'Add bill', icon: IconCamera },
  },
  accountant: {
    items: [
      { to: '/accountant', label: 'Home', icon: IconHome, end: true },
      { to: '/accountant/projects', label: 'Projects', icon: IconFolder },
      { to: '/accountant/alerts', label: 'Alerts', icon: IconBell, badge: true },
      { to: '/accountant/profile', label: 'Profile', icon: IconUser },
    ],
    center: { to: '/accountant/review', label: 'Review', icon: IconClipboardCheck },
  },
  admin: {
    items: [
      { to: '/admin', label: 'Overview', icon: IconGrid, end: true },
      { to: '/admin/users', label: 'Users', icon: IconUsers },
      { to: '/admin/projects', label: 'Projects', icon: IconFolder },
      { to: '/admin/deliveries', label: 'Bills', icon: IconBill },
      { to: '/admin/profile', label: 'Profile', icon: IconUser },
    ],
  },
}

function Tab({ item, unread }: { item: NavItem; unread: number }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end} className="flex-1 flex flex-col items-center gap-1 py-2">
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon size={21} stroke={isActive ? 'var(--color-accent)' : 'var(--color-ink-faint)'} strokeWidth={isActive ? 2.2 : 2} />
            {item.badge && unread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-[#d64545] text-white text-[10px] font-bold leading-[17px] text-center ring-2 ring-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          <span className={`text-[10.5px] ${isActive ? 'font-bold text-accent' : 'font-medium text-ink-faint'}`}>
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  )
}

function CenterButton({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} className="flex-1 flex flex-col items-center -mt-7" aria-label={item.label}>
      {({ isActive }) => (
        <>
          <span
            className={`w-[58px] h-[58px] rounded-full flex items-center justify-center ring-[5px] ring-white/90 shadow-[0_12px_24px_-10px_rgba(26,60,94,0.8)] bg-gradient-to-br ${
              isActive ? 'from-ink to-ink' : 'from-[#2f5f8a] to-accent'
            }`}
          >
            <Icon size={24} stroke="#FFFFFF" />
          </span>
          <span className="text-[10.5px] font-bold text-accent mt-1">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/** The role's bottom tab bar. Fixed to the bottom of the phone column. */
export function BottomNav() {
  const { user } = useSession()
  const unread = useUnreadCount()
  if (!user) return null
  const { items, center } = NAV[user.role]
  const [left, right] = center ? [items.slice(0, 2), items.slice(2)] : [items, []]

  return (
    <nav className="fixed bottom-0 sm:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-3 pb-3 z-20">
      <div className="flex items-end glass-strong rounded-[26px] px-1.5">
        {left.map((item) => (
          <Tab key={item.to} item={item} unread={unread} />
        ))}
        {center && <CenterButton item={center} />}
        {right.map((item) => (
          <Tab key={item.to} item={item} unread={unread} />
        ))}
      </div>
    </nav>
  )
}

/** A tab screen: scrolls normally, with room at the bottom so the nav never covers content. */
export function TabScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col flex-grow text-ink">
      {children}
      <div className="h-28 flex-shrink-0" />
      <BottomNav />
    </div>
  )
}
