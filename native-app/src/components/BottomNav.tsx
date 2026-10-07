import type { BottomTabBarProps } from 'expo-router/tabs'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnreadCount } from '../lib/notifications'
import type { Role } from '../lib/session'
import { colors, glassStrong, navyGradient } from '../lib/theme'
import { Frost, FROST, useTabBackdrop } from './Frost'
import { UnreadBadge } from './headers'
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
  type Icon,
} from './icons'
import { T } from './T'
import { Tap } from './ui'

// The role's bottom tab bar, as on the web (frontend/src/components/BottomNav.tsx): frosted bar,
// raised round centre button, red unread badge on Alerts. Used as the tab navigator's tabBar.

interface NavItem {
  route: string
  label: string
  icon: Icon
  badge?: boolean
}

const NAV: Record<Role, { items: NavItem[]; center?: NavItem }> = {
  supervisor: {
    items: [
      { route: 'index', label: 'Home', icon: IconHome },
      { route: 'bills', label: 'My bills', icon: IconBill },
      { route: 'alerts', label: 'Alerts', icon: IconBell, badge: true },
      { route: 'profile', label: 'Profile', icon: IconUser },
    ],
    center: { route: 'add', label: 'Add bill', icon: IconCamera },
  },
  accountant: {
    items: [
      { route: 'index', label: 'Home', icon: IconHome },
      { route: 'projects', label: 'Projects', icon: IconFolder },
      { route: 'alerts', label: 'Alerts', icon: IconBell, badge: true },
      { route: 'profile', label: 'Profile', icon: IconUser },
    ],
    center: { route: 'review', label: 'Review', icon: IconClipboardCheck },
  },
  admin: {
    items: [
      { route: 'index', label: 'Overview', icon: IconGrid },
      { route: 'users', label: 'Users', icon: IconUsers },
      { route: 'projects', label: 'Projects', icon: IconFolder },
      { route: 'deliveries', label: 'Bills', icon: IconBill },
      { route: 'profile', label: 'Profile', icon: IconUser },
    ],
  },
}

/** Space a tab screen leaves at the bottom of its content so the bar never covers it (web: h-28). */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets()
  return 112 + insets.bottom
}

export function BottomNav({ role, state, navigation }: BottomTabBarProps & { role: Role }) {
  const insets = useSafeAreaInsets()
  const unread = useUnreadCount()
  const backdrop = useTabBackdrop()
  const { items, center } = NAV[role]
  const current = state.routes[state.index]?.name
  const go = (route: string) => {
    if (route !== current) navigation.navigate(route)
  }
  const [left, right] = center ? [items.slice(0, 2), items.slice(2)] : [items, []]

  const tab = (item: NavItem) => {
    const active = item.route === current
    const IconC = item.icon
    return (
      <Tap key={item.route} onPress={() => go(item.route)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
        <View>
          <IconC size={21} stroke={active ? colors.accent : colors.inkFaint} strokeWidth={active ? 2.2 : 2} />
          {item.badge ? <UnreadBadge count={unread} size={17} style={{ position: 'absolute', top: -6, right: -8 }} /> : null}
        </View>
        <T size={10.5} weight={active ? 700 : 500} color={active ? colors.accent : colors.inkFaint}>
          {item.label}
        </T>
      </Tap>
    )
  }

  return (
    <View style={[styles.wrap, { paddingBottom: 12 + insets.bottom }]} pointerEvents="box-none">
      <View style={[glassStrong, styles.bar]}>
        <Frost {...FROST.strong} backdrop={backdrop} style={{ borderRadius: 25 }} />
        {left.map(tab)}
        {center ? (
          <Tap onPress={() => go(center.route)} accessibilityLabel={center.label} style={styles.centerTab}>
            <View
              style={[
                styles.centerButton,
                { experimental_backgroundImage: center.route === current ? undefined : navyGradient },
                center.route === current && { backgroundColor: colors.ink },
              ]}
            >
              <center.icon size={24} stroke={colors.white} />
            </View>
            <T size={10.5} weight={700} color={colors.accent} style={{ marginTop: 4 }}>
              {center.label}
            </T>
          </Tap>
        ) : null}
        {right.map(tab)}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 26, paddingHorizontal: 6, backgroundColor: 'transparent' },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8 },
  centerTab: { flex: 1, alignItems: 'center', marginTop: -28 },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    outlineWidth: 5,
    outlineStyle: 'solid',
    outlineColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0px 12px 24px -10px rgba(26, 60, 94, 0.8)',
  },
})
