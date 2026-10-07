import { BlurTargetView, BlurView } from 'expo-blur'
import { useFocusEffect } from 'expo-router'
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { glassStrong } from '../lib/theme'

// Frosted glass: the web's `backdrop-filter: blur()`. A BlurView shows a blurred copy of a "backdrop"
// (a BlurTargetView) that lies behind it, and it can't sit inside its own backdrop, so each frosted
// panel is told which backdrop it floats over. Android 12+ blurs; older phones get the plain tint.

type Backdrop = RefObject<View | null>

const ScopeContext = createContext<Backdrop | null>(null)

/** Groups a backdrop with the frosted panels floating over it (they must be siblings, not children). */
export function FrostScope({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null)
  return <ScopeContext.Provider value={ref}>{children}</ScopeContext.Provider>
}

/** What the scope's frosted panels blur: everything drawn inside it. */
export function FrostBackdrop({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useContext(ScopeContext)
  return (
    <BlurTargetView ref={ref ?? undefined} style={style}>
      {children}
    </BlurTargetView>
  )
}

// The bottom tab bar is drawn by the tab navigator, outside the screens, so the focused tab screen
// registers itself as the bar's backdrop.
let tabBackdrop: Backdrop | null = null
const tabListeners = new Set<() => void>()

/** Wraps each tab screen (the navigator's screenLayout) so the bottom bar can blur it. */
export function TabBackdrop({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null)
  useFocusEffect(
    useCallback(() => {
      tabBackdrop = ref
      tabListeners.forEach((listener) => listener())
    }, []),
  )
  return (
    <BlurTargetView ref={ref} style={{ flex: 1 }}>
      {children}
    </BlurTargetView>
  )
}

export function useTabBackdrop() {
  return useSyncExternalStore(
    (listener) => {
      tabListeners.add(listener)
      return () => tabListeners.delete(listener)
    },
    () => tabBackdrop,
  )
}

/**
 * A CSS blur(px) as the BlurView's radius in device pixels. CSS blur is a standard deviation in CSS
 * px (1 px = 1 dp); Android turns a radius r into a standard deviation of 0.57735 r + 0.5 pixels.
 */
function radiusFor(cssBlur: number) {
  return Math.max(1, (cssBlur * PixelRatio.get() - 0.5) / 0.57735)
}

/** The web's glass panels: tint, blur and top highlight (index.css `glass` / `glass-strong`). */
export const FROST = {
  glass: { blur: 16, tint: 'rgba(255, 255, 255, 0.58)', highlight: 'inset 0px 1px 0px rgba(255, 255, 255, 0.7)' },
  strong: { blur: 20, tint: 'rgba(255, 255, 255, 0.8)', highlight: 'inset 0px 1px 0px rgba(255, 255, 255, 0.8)' },
} as const

/**
 * The frosted fill of a panel: put it first inside the panel (whose own background is transparent).
 * It fills the panel's inside, so give it the panel's corner radius minus any border.
 */
export function Frost({
  blur,
  tint,
  highlight,
  backdrop,
  style,
}: {
  blur: number
  tint: string
  highlight?: string
  backdrop?: Backdrop | null
  style?: StyleProp<ViewStyle>
}) {
  const scope = useContext(ScopeContext)
  const source = backdrop ?? scope
  // The BlurView picks up its backdrop when it mounts or when the backdrop changes, so it's handed
  // a fresh ref once the backdrop view exists (it may mount after this panel).
  const [target, setTarget] = useState<Backdrop | undefined>(undefined)
  const [, recheck] = useState(0)
  // Runs after every render on purpose: the backdrop is a ref, which changes without a render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!source) return // no backdrop: just the tint (as on phones without blur)
    const view = source.current
    if (!view) {
      const timer = setTimeout(() => recheck((n) => n + 1), 50)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (target?.current !== view) setTarget({ current: view })
  })

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      {/* intensity 1 keeps expo-blur's own white wash invisible, so the radius is set through the
          reduction factor: the blur library multiplies the radius it's given by its downscale of 4. */}
      <BlurView
        blurTarget={target}
        // Blur only once the backdrop is known (expo-blur warns about a blur method with no target).
        blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
        intensity={1}
        blurReductionFactor={4 / radiusFor(blur)}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, boxShadow: highlight }]} />
    </View>
  )
}

/**
 * The frosted action bar pinned to the bottom of a form screen (web: `sticky bottom-0`): the form
 * scrolls under it. It reports its height so the form can leave that much room at its end.
 */
export function ActionBar({ children, onHeight }: { children: ReactNode; onHeight: (height: number) => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      style={[styles.actionWrap, { paddingBottom: 12 + insets.bottom }]}
    >
      <View style={[glassStrong, styles.actionBar]}>
        <Frost {...FROST.strong} style={{ borderRadius: 23 }} />
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actionWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 8 },
  actionBar: { borderRadius: 24, padding: 10, gap: 8, backgroundColor: 'transparent' },
})
