import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { authedImageSource } from '../lib/api'
import { colors } from '../lib/theme'
import { IconClose } from './icons'
import { T } from './T'
import { Tap } from './ui'

/**
 * Full-screen viewer for a protected bill photo. Renders nothing when `src` is null. Pinch or
 * double-tap to zoom (in the browser the whole page can be pinch-zoomed; this keeps that ability).
 */
export function PhotoViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

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
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  top: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, zIndex: 2 },
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
