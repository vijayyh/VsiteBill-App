import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'

const tabs = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Users', end: false },
  { to: '/admin/projects', label: 'Projects', end: false },
  { to: '/admin/deliveries', label: 'Deliveries', end: false },
]

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useSession()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col flex-grow text-ink">
      <div className="flex-shrink-0 px-5 pt-5 pb-4 bg-surface border-b border-border">
        <div className="text-xs text-ink-muted font-medium">Admin</div>
        <div className="flex items-center justify-between mt-0.5">
          <div className="text-xl font-bold">{title}</div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            aria-label="Log out"
            className="w-[38px] h-[38px] rounded-full bg-avatar-bg flex items-center justify-center text-[13px] font-bold text-accent"
          >
            {user?.initials}
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 flex gap-1.5 px-4 pt-3 pb-1 bg-surface border-b border-border">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `text-[12.5px] font-bold rounded-full px-3.5 py-1.5 ${
                isActive ? 'bg-accent text-white' : 'bg-surface-alt text-ink-muted'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="flex-grow overflow-y-auto px-4 py-3.5">{children}</div>
    </div>
  )
}
