import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, pageBackground } from '../lib/theme'

/** The page's soft colour wash (the web's `bg-page`), fixed behind the content. */
export function PageBackground() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { experimental_backgroundImage: pageBackground }]} />
}

/** The navy band behind the status bar (the installed web app shows its theme colour there). */
export function StatusBand() {
  const insets = useSafeAreaInsets()
  return <View pointerEvents="none" style={[styles.band, { height: insets.top }]} />
}

/** A full screen: page background, content starting below the status bar. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.screen, { paddingTop: insets.top }, style]}>
      <PageBackground />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.pageTop },
  band: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.accent, zIndex: 10 },
})
