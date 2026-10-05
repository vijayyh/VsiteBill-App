import type { ComponentType } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TabScreen } from '../../components/BottomNav'
import { EmptyState, PageTitle } from '../../components/ui'
import { IconAlertTriangle, IconBell, IconBill, IconCheck, IconLock } from '../../components/icons'
import { api, useApiGet } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { refreshUnreadCount } from '../../lib/notifications'
import type { AppNotification, NotificationKind } from '../../lib/types'

type Icon = ComponentType<{ size?: number; stroke?: string; strokeWidth?: number }>

const KIND_STYLE: Record<NotificationKind, { icon: Icon; tint: string; color: string }> = {
  bill_new: { icon: IconBill, tint: 'bg-info-bg', color: 'var(--color-info-text)' },
  bill_flagged: { icon: IconAlertTriangle, tint: 'bg-warning-bg', color: 'var(--color-warning-text)' },
  bill_matched: { icon: IconCheck, tint: 'bg-success-bg', color: 'var(--color-success-text)' },
  password_reset: { icon: IconLock, tint: 'bg-warning-bg', color: 'var(--color-warning-text)' },
}

export function Alerts() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data, loading, refetch } = useApiGet<{ notifications: AppNotification[]; unreadCount: number }>(
    '/api/notifications',
  )
  const items = data?.notifications ?? []
  const unread = data?.unreadCount ?? 0

  async function open(item: AppNotification) {
    if (!item.read) {
      await api.post(`/api/notifications/${item.id}/read`).catch(() => {})
      refreshUnreadCount()
    }
    // Opened screens use `from` for their back button, so Back returns to Alerts.
    if (item.link) navigate(item.link, { state: { from: pathname } })
    else refetch()
  }

  async function markAllRead() {
    await api.post('/api/notifications/read-all')
    refreshUnreadCount()
    refetch()
  }

  return (
    <TabScreen>
      <PageTitle
        title="Alerts"
        subtitle={loading ? undefined : unread ? `${unread} unread` : 'You’re all caught up'}
        right={
          unread > 0 && (
            <button onClick={markAllRead} className="glass rounded-full px-3.5 py-2 text-[12px] font-bold text-accent">
              Mark all read
            </button>
          )
        }
      />
      <div className="px-5 flex flex-col gap-2.5">
        {loading && <div className="text-sm text-ink-muted text-center mt-4">Loading alerts…</div>}
        {!loading && items.length === 0 && (
          <EmptyState icon={IconBell} title="No alerts yet" body="When something needs your attention, it shows up here." />
        )}
        {items.map((item) => {
          const style = KIND_STYLE[item.kind] ?? KIND_STYLE.bill_new
          const Icon = style.icon
          return (
            <button
              key={item.id}
              onClick={() => open(item)}
              className={`glass rounded-card flex items-start gap-3 p-3.5 text-left ${item.read ? 'opacity-75' : 'ring-1 ring-accent/15'}`}
            >
              <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-white/80 ${style.tint}`}>
                <Icon size={18} stroke={style.color} strokeWidth={2.3} />
              </span>
              <div className="flex-grow min-w-0">
                <div className="flex items-start gap-2">
                  <div className={`flex-grow text-[13.5px] leading-snug ${item.read ? 'font-semibold' : 'font-bold'}`}>
                    {item.title}
                  </div>
                  {!item.read && <span className="w-2 h-2 rounded-full bg-[#d64545] mt-1.5 flex-shrink-0" />}
                </div>
                {item.body && <div className="text-[12.5px] text-ink-muted mt-0.5 leading-snug">{item.body}</div>}
                <div className="text-[11px] text-ink-faint mt-1">{formatDateTime(item.createdAt)}</div>
              </div>
            </button>
          )
        })}
      </div>
    </TabScreen>
  )
}
