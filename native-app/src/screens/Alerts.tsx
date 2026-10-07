import { router, type Href } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useTabBarSpace } from '../components/BottomNav'
import { IconAlertTriangle, IconBell, IconBill, IconCheck, IconLock, type Icon } from '../components/icons'
import { Screen } from '../components/Screen'
import { T } from '../components/T'
import { EmptyState, PageTitle, Tap } from '../components/ui'
import { api, useApiGet } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { refreshUnreadCount } from '../lib/notifications'
import { colors, glass, radii, ring } from '../lib/theme'
import type { AppNotification, NotificationKind } from '../lib/types'

// Same as the web app's Alerts screen (frontend/src/screens/common/Alerts.tsx), for every role.
const KIND_STYLE: Record<NotificationKind, { icon: Icon; tint: string; color: string }> = {
  bill_new: { icon: IconBill, tint: colors.infoBg, color: colors.infoText },
  bill_flagged: { icon: IconAlertTriangle, tint: colors.warningBg, color: colors.warningText },
  bill_matched: { icon: IconCheck, tint: colors.successBg, color: colors.successText },
  password_reset: { icon: IconLock, tint: colors.warningBg, color: colors.warningText },
}

export default function Alerts() {
  const space = useTabBarSpace()
  const { data, loading, refetch, refresh, refreshing } = useApiGet<{ notifications: AppNotification[]; unreadCount: number }>(
    '/api/notifications',
  )
  const items = data?.notifications ?? []
  const unread = data?.unreadCount ?? 0

  async function open(item: AppNotification) {
    if (!item.read) {
      await api.post(`/api/notifications/${item.id}/read`).catch(() => {})
      refreshUnreadCount()
    }
    if (item.link) router.push(item.link as Href)
    else refetch()
  }

  async function markAllRead() {
    await api.post('/api/notifications/read-all').catch(() => {})
    refreshUnreadCount()
    refetch()
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.accent]} />}
      >
        <PageTitle
          title="Alerts"
          subtitle={loading ? undefined : unread ? `${unread} unread` : 'You’re all caught up'}
          right={
            unread > 0 ? (
              <Tap onPress={() => void markAllRead()} style={[glass, styles.markAll]}>
                <T size={12} weight={700} color={colors.accent}>
                  Mark all read
                </T>
              </Tap>
            ) : null
          }
        />
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {loading ? (
            <T size={14} lh={20 / 14} color={colors.inkMuted} style={{ textAlign: 'center', marginTop: 16 }}>
              Loading alerts…
            </T>
          ) : null}
          {!loading && items.length === 0 ? (
            <EmptyState icon={IconBell} title="No alerts yet" body="When something needs your attention, it shows up here." />
          ) : null}
          {items.map((item) => {
            const style = KIND_STYLE[item.kind] ?? KIND_STYLE.bill_new
            const IconC = style.icon
            return (
              <Tap
                key={item.id}
                onPress={() => void open(item)}
                style={[glass, styles.item, item.read && { opacity: 0.75 }]}
              >
                <View style={[styles.icon, { backgroundColor: style.tint }]}>
                  <IconC size={18} stroke={style.color} strokeWidth={2.3} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <T size={13.5} weight={item.read ? 600 : 700} lh={1.375} style={{ flex: 1 }}>
                      {item.title}
                    </T>
                    {!item.read ? <View style={styles.dot} /> : null}
                  </View>
                  {item.body ? (
                    <T size={12.5} lh={1.375} color={colors.inkMuted} style={{ marginTop: 2 }}>
                      {item.body}
                    </T>
                  ) : null}
                  <T size={11} color={colors.inkFaint} style={{ marginTop: 4 }}>
                    {formatDateTime(item.createdAt)}
                  </T>
                </View>
              </Tap>
            )
          })}
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  markAll: { borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 8 },
  item: { borderRadius: radii.card, flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...ring(1, 'rgba(255,255,255,0.8)'),
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.badge, marginTop: 6 },
})
