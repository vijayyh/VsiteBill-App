import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { authedImageSource } from '../lib/api'
import { colors } from '../lib/theme'
import { IconChevronRight, IconClose } from './icons'
import { T } from './T'
import { Tap } from './ui'

/** "3 pages" on a bill's thumbnail (an absolutely placed label), for a bill of more than one page. */
export function PagesBadge({ count }: { count: number }) {
  if (count < 2) return null
  return (
    <View pointerEvents="none" style={styles.badge}>
      <T size={10} weight={700} color={colors.white}>
        {count} pages
      </T>
    </View>
  )
}

/**
 * Full-screen viewer for a protected bill photo, or for every page of a bill (an array, in page
 * order, with previous/next). Renders nothing when `src` is null. Pinch or double-tap to zoom (in
 * the browser the whole page can be pinch-zoomed; this keeps that ability). Android's back closes it.
 */
export function PhotoViewer({ src: pagesOrPhoto, onClose }: { src: string | string[] | null; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const pages = pagesOrPhoto === null ? [] : Array.isArray(pagesOrPhoto) ? pagesOrPhoto : [pagesOrPhoto]
  // The page shown, for this set of pages (a new set starts at page 1).
  const pagesKey = pages.join('|')
  const [shown, setShown] = useState({ key: '', index: 0 })
  const index = shown.key === pagesKey ? Math.min(shown.index, pages.length - 1) : 0
  const src = pages.length > 0 ? pages[index] : null

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const savedTx = useSharedValue(0)
  const savedTy = useSharedValue(0)

  const reset = () => {
    'worklet'
    scale.value = withTiming(1)
    savedScale.value = 1
    tx.value = withTiming(0)
    ty.value = withTiming(0)
    savedTx.value = 0
    savedTy.value = 0
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(6, Math.max(1, savedScale.value * e.scale))
    })
    .onEnd(() => {
      savedScale.value = scale.value
      if (scale.value <= 1.01) reset()
    })
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value <= 1) return
      tx.value = savedTx.value + e.translationX
      ty.value = savedTy.value + e.translationY
    })
    .onEnd(() => {
      savedTx.value = tx.value
      savedTy.value = ty.value
    })
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset()
      } else {
        scale.value = withTiming(2.5)
        savedScale.value = 2.5
      }
    })
  const gestures = Gesture.Simultaneous(pinch, pan, doubleTap)
  // A different photo: start over (loading, not zoomed).
  const [shownSrc, setShownSrc] = useState(src)
  if (src !== shownSrc) {
    setShownSrc(src)
    setState('loading')
  }
  useEffect(() => {
    scale.value = 1
    savedScale.value = 1
    tx.value = 0
    ty.value = 0
    savedTx.value = 0
    savedTy.value = 0
  }, [src, scale, savedScale, tx, ty, savedTx, savedTy])

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }))

  if (!src) return null

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* Like the installed web app: the status bar stays navy and the strip behind the system
          navigation bar stays clear; the dark backdrop covers only the page area between them. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ height: insets.top, backgroundColor: colors.accent }} />
        <View style={[styles.backdrop, { marginBottom: insets.bottom }]}>
          <View style={styles.top}>
            <T size={13} weight={600} color="rgba(255,255,255,0.8)" accessibilityLiveRegion="polite">
              {pages.length > 1 ? `Page ${index + 1} of ${pages.length}` : ''}
            </T>
            <Tap onPress={onClose} accessibilityLabel="Close photo" style={styles.close}>
              <IconClose size={18} stroke={colors.white} />
            </Tap>
          </View>
          <View style={styles.stage}>
            <GestureDetector gesture={gestures}>
              <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
                <Image
                  source={authedImageSource(src)}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  accessibilityLabel="Delivery challan"
                  onLoad={() => setState('ready')}
                  onError={() => setState('failed')}
                />
              </Animated.View>
            </GestureDetector>
            {state !== 'ready' ? (
              <View pointerEvents="none" style={styles.message}>
                <T size={14} lh={20 / 14} color="rgba(255,255,255,0.7)">
                  {state === 'failed' ? 'Could not load this photo.' : 'Loading…'}
                </T>
              </View>
            ) : null}
          </View>
          {pages.length > 1 ? (
            <View style={styles.pager}>
              <Tap
                onPress={() => setShown({ key: pagesKey, index: index - 1 })}
                disabled={index === 0}
                accessibilityLabel="Previous page"
                style={[styles.close, styles.pageButton, index === 0 && { opacity: 0.3 }]}
              >
                <View style={{ transform: [{ rotate: '180deg' }] }}>
                  <IconChevronRight size={20} stroke={colors.white} />
                </View>
              </Tap>
              <Tap
                onPress={() => setShown({ key: pagesKey, index: index + 1 })}
                disabled={index === pages.length - 1}
                accessibilityLabel="Next page"
                style={[styles.close, styles.pageButton, index === pages.length - 1 && { opacity: 0.3 }]}
              >
                <IconChevronRight size={20} stroke={colors.white} />
              </Tap>
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingLeft: 20, zIndex: 2 },
  pager: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingBottom: 24, zIndex: 2 },
  pageButton: { width: 44, height: 44, borderRadius: 22 },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Margins, not padding: the photo fills the stage absolutely, and absolute children ignore padding.
  stage: { flex: 1, marginHorizontal: 16, marginBottom: 32, overflow: 'hidden' },
  message: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
})
