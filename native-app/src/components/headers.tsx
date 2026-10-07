import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { greeting } from '../lib/format'
import { useUnreadCount } from '../lib/notifications'
import { useSession } from '../lib/session'
import { colors, glassStrong, navyGradient, ring, shadowSoft } from '../lib/theme'
import { Frost, FROST } from './Frost'
import { IconBack, IconBell } from './icons'
import { T } from './T'
import { Tap } from './ui'

// Native versions of AppHeader, BellButton and ScreenHeader from the web app.

const ROLE_LABEL = { supervisor: 'Site supervisor', accountant: 'Office · bill review', admin: 'Admin' } as const

/** Red unread count, as on the bell and the Alerts tab. */
export function UnreadBadge({ count, size = 18, style }: { count: number; size?: number; style?: object }) {
  if (count <= 0) return null
  return (
    <View style={[styles.unread, { minWidth: size, height: size, borderRadius: size / 2 }, style]}>
      <T size={10} weight={700} color={colors.white} lh={size / 10} style={{ textAlign: 'center' }}>
        {count > 9 ? '9+' : count}
      </T>
    </View>
  )
}

/** Round bell button opening the role's Alerts tab, with the unread count. */
export function BellButton() {
  const { user } = useSession()
  const unread = useUnreadCount()
  if (!user) return null
  return (
    <Tap
      onPress={() => router.navigate(`/${user.role}/alerts`)}
      accessibilityLabel={unread ? `${unread} unread alerts` : 'Alerts'}
      style={[glassStrong, styles.bell]}
    >
      <IconBell size={19} stroke={colors.ink} />
      <UnreadBadge count={unread} style={{ position: 'absolute', top: -2, right: -2 }} />
    </Tap>
  )
}

/** Greeting header used on each role's home tab: avatar, name, and a bell with the unread count. */
export function AppHeader() {
  const { user } = useSession()
  if (!user) return null
  return (
    <View style={styles.appHeader}>
      <Tap onPress={() => router.navigate(`/${user.role}/profile`)} accessibilityLabel="Your profile" style={styles.avatar}>
        <T size={14} weight={700} color={colors.white}>
          {user.initials}
        </T>
      </Tap>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={12} color={colors.inkMuted}>
          {greeting()},
        </T>
        <T size={18} weight={700} lh={1.25} numberOfLines={1}>
          {user.name}
        </T>
        <T size={11} color={colors.inkFaint}>
          {ROLE_LABEL[user.role]}
        </T>
      </View>
      <BellButton />
    </View>
  )
}

/** Height of ScreenHeader, so screens can leave room for it at the top of their scroll content. */
export const SCREEN_HEADER_HEIGHT = 12 + 56 + 8

/** Back-button header for inner screens. Frosted and pinned to the top while the page scrolls under it. */
export function ScreenHeader({
  title,
  subtitle,
  action,
  onBack,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  onBack?: () => void
}) {
  // Absolute, so it floats over the page as it scrolls; it starts below the status bar.
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.screenHeaderWrap, { top: insets.top }]} pointerEvents="box-none">
      <View style={[glassStrong, styles.screenHeader]}>
        <Frost {...FROST.strong} style={{ borderRadius: 19 }} />
        <Tap onPress={onBack ?? (() => router.back())} accessibilityLabel="Go back" style={styles.back}>
          <IconBack size={20} stroke={colors.ink} />
        </Tap>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={15.5} weight={700} lh={1.25} numberOfLines={1}>
            {title}
          </T>
          {subtitle ? (
            <T size={11.5} color={colors.inkMuted} numberOfLines={1}>
              {subtitle}
            </T>
          ) : null}
        </View>
        {action ? <View style={{ paddingRight: 6, flexShrink: 0 }}>{action}</View> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  unread: {
    paddingHorizontal: 4,
    backgroundColor: colors.badge,
    ...ring(2, colors.white),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  appHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    experimental_backgroundImage: navyGradient,
    boxShadow: shadowSoft,
  },
  screenHeaderWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, zIndex: 10 },
  screenHeader: { borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, height: 56, backgroundColor: 'transparent' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
})
