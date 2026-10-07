import { Image } from 'expo-image'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { isOnline } from '../lib/offlineQueue'
import { INTRO_MS, MAX_MS, OFFLINE_EXTRA_MS, WAIT_HINT_MS, wakeServer } from '../lib/splash'
import { colors } from '../lib/theme'
import { T } from './T'

// The opening animation, matching the website's (frontend/index.html + src/lib/splash.ts). Its
// first frame is identical to the native splash (assets/splash-icon.png, 300 dp, centred on navy),
// so hiding the native splash shows no change; then: the tile hands its glow to a soft aura, the
// document lifts, a light sweeps across it, the check is "stamped" with a ripple, and "SiteVerify"
// rises in letter by letter. The server is pinged meanwhile; the app opens within 5 s at most.

const LOGO = 300 // dp, same as the native splash image
const U = LOGO / 512 // artwork units (512) to dp
const ease = Easing.bezier(0.22, 1, 0.36, 1)
const NAVY = '#1A3C5E'
const DOC_PATH = 'M-102 -112 A24 24 0 0 1 -78 -136 H40 L102 -74 V112 A24 24 0 0 1 78 136 H-78 A24 24 0 0 1 -102 112 Z'
const LETTERS = ['S', 'i', 't', 'e', 'V', 'e', 'r', 'i', 'f', 'y']

// The check, its own box so it can be "stamped" (scaled) about its centre: artwork points
// (-56,14) (-16,54) (60,-26) around (256,252), with a 32-unit round stroke.
const CHECK_BOX = { x: 184, y: 210, w: 148, h: 112 }
const CHECK_CENTRE = { x: 258, y: 266 }

const AnimatedRect = Animated.createAnimatedComponent(Rect)

// When the app started (the native splash has been showing since about then).
const opened = Date.now()
// Start waking the server as early as possible.
const serverUp: Promise<boolean> = isOnline().then((online) => (online ? wakeServer() : false))

function useRise(delay: number, play: boolean, distance = 16, duration = 650) {
  const v = useSharedValue(0)
  useEffect(() => {
    if (play) v.value = withDelay(delay, withTiming(1, { duration, easing: ease }))
  }, [play, delay, duration, v])
  return useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * distance }] }))
}

function Letter({ ch, i, play, green }: { ch: string; i: number; play: boolean; green: boolean }) {
  const style = useRise(420 + i * 32, play)
  return (
    <Animated.Text style={[styles.letter, green && { color: '#86dba6' }, style]}>{ch}</Animated.Text>
  )
}

function useFade(value: SharedValue<number>) {
  return useAnimatedStyle(() => ({ opacity: value.value }))
}

export function SplashIntro({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets()
  const [play, setPlay] = useState(false)
  const [status, setStatus] = useState<null | 'waking' | 'offline'>(null)
  const reduceMotion = useRef(false)

  const lift = useSharedValue(0)
  const tile = useSharedValue(1)
  const aura = useSharedValue(0)
  const breathe = useSharedValue(1)
  const sheen = useSharedValue(-300)
  const stamp = useSharedValue(1)
  const ripple = useSharedValue(0)
  const footer = useSharedValue(0)
  const statusV = useSharedValue(0)
  const exit = useSharedValue(0)

  // First frame is on screen: swap out the native splash (identical), then play.
  const onFirstLayout = () => {
    void (async () => {
      reduceMotion.current = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
      await SplashScreen.hideAsync().catch(() => {})
      setPlay(true)
    })()
  }

  useEffect(() => {
    if (!play) return
    const quick = reduceMotion.current
    const t = (ms: number) => (quick ? 1 : ms)
    lift.value = withTiming(1, { duration: t(950), easing: ease })
    tile.value = withDelay(t(40), withTiming(0, { duration: t(380), easing: Easing.out(Easing.quad) }))
    aura.value = withDelay(t(150), withTiming(1, { duration: t(900), easing: Easing.out(Easing.quad) }))
    if (!quick) {
      breathe.value = withDelay(1400, withRepeat(withTiming(1.1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true))
      sheen.value = withDelay(180, withTiming(300, { duration: 1150, easing: Easing.bezier(0.45, 0, 0.2, 1) }))
      stamp.value = withDelay(
        420,
        withSequence(
          withTiming(0.84, { duration: 200, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.14, { duration: 245, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 275, easing: Easing.inOut(Easing.quad) }),
        ),
      )
      ripple.value = withDelay(560, withTiming(1, { duration: 1100, easing: Easing.bezier(0.2, 0.7, 0.3, 1) }))
    }
    footer.value = withDelay(t(1000), withTiming(1, { duration: t(800), easing: Easing.out(Easing.quad) }))

    // Hand over: same rules as the website (at least the intro; at most 5 s after opening while
    // the server wakes; offline, leave the note up a little longer and don't wait).
    let finished = false
    const introStart = Date.now()
    const timers: ReturnType<typeof setTimeout>[] = []
    const finish = (offline: boolean) => {
      if (finished) return
      finished = true
      timers.forEach(clearTimeout)
      const earliest = introStart + (quick ? 600 : INTRO_MS) + (offline ? OFFLINE_EXTRA_MS : 0)
      setTimeout(() => {
        exit.value = withTiming(1, { duration: 520, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        setTimeout(onDone, 540)
      }, Math.max(0, earliest - Date.now()))
    }
    void isOnline().then((online) => {
      if (!online) {
        setStatus('offline')
        statusV.value = withDelay(900, withTiming(1, { duration: 500, easing: ease }))
        finish(true)
        return
      }
      timers.push(
        setTimeout(() => {
          setStatus('waking')
          statusV.value = withTiming(1, { duration: 500, easing: ease })
        }, Math.max(opened + WAIT_HINT_MS, introStart + 1200) - Date.now()),
      )
      timers.push(setTimeout(() => finish(false), Math.max(opened + MAX_MS, introStart + INTRO_MS) - Date.now()))
      void serverUp.then(() => finish(false))
    })
    return () => timers.forEach(clearTimeout)
  }, [play, lift, tile, aura, breathe, sheen, stamp, ripple, footer, statusV, exit, onDone])

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -78 * lift.value }, { scale: 1 - 0.26 * lift.value }],
  }))
  const tileStyle = useFade(tile)
  const auraStyle = useAnimatedStyle(() => ({ opacity: aura.value, transform: [{ scale: breathe.value }] }))
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: stamp.value }] }))
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: ripple.value === 0 ? 0 : 0.75 * (1 - ripple.value),
    transform: [{ scale: 0.55 + 1.95 * ripple.value }],
  }))
  const sheenProps = useAnimatedProps(() => ({ x: -55 + sheen.value }))
  const footerStyle = useFade(footer)
  const statusStyle = useAnimatedStyle(() => ({ opacity: statusV.value, transform: [{ translateY: (1 - statusV.value) * 16 }] }))
  const exitStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }))
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 * exit.value }, { scale: 1 + 0.06 * exit.value }],
  }))
  const taglineStyle = useRise(820, play, 16, 700)

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, exitStyle]} onLayout={onFirstLayout} accessibilityLabel="SiteVerify is starting">
      <Animated.View style={[StyleSheet.absoluteFill, stageStyle]}>
        <Animated.View style={[styles.aura, auraStyle]} />

        <Animated.View style={[styles.logo, logoStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, tileStyle]}>
            <Image source={require('../../assets/splash-tile.png')} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Image source={require('../../assets/splash-doc.png')} style={StyleSheet.absoluteFill} />
          {/* Light sweeping across the document, clipped to its shape. */}
          <Svg width={LOGO} height={LOGO} viewBox="0 0 512 512" style={StyleSheet.absoluteFill}>
            <Defs>
              <ClipPath id="doc">
                <Path d={DOC_PATH} transform="translate(256 252)" />
              </ClipPath>
              <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#DCEBFA" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <G clipPath="url(#doc)">
              <G transform="translate(256 252) rotate(20)">
                <AnimatedRect animatedProps={sheenProps} y={-260} width={110} height={520} fill="url(#sheen)" />
              </G>
            </G>
          </Svg>
          {/* Ripple from the check's centre. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ripple,
              { left: CHECK_CENTRE.x * U - 58 * U, top: CHECK_CENTRE.y * U - 58 * U, width: 116 * U, height: 116 * U, borderRadius: 58 * U, borderWidth: 5 * U },
              rippleStyle,
            ]}
          />
          {/* The check, stamped about its own centre. */}
          <Animated.View
            style={[
              { position: 'absolute', left: CHECK_BOX.x * U, top: CHECK_BOX.y * U, width: CHECK_BOX.w * U, height: CHECK_BOX.h * U },
              checkStyle,
            ]}
          >
            <Svg width={CHECK_BOX.w * U} height={CHECK_BOX.h * U} viewBox={`${CHECK_BOX.x} ${CHECK_BOX.y} ${CHECK_BOX.w} ${CHECK_BOX.h}`}>
              <Defs>
                <LinearGradient id="green" x1="0" y1="212" x2="0" y2="312" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#3FB872" />
                  <Stop offset="1" stopColor="#1F8447" />
                </LinearGradient>
              </Defs>
              <Path
                d="M200 266 L240 306 L316 226"
                fill="none"
                stroke="url(#green)"
                strokeWidth={32}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </Animated.View>

        <View style={styles.text} pointerEvents="none">
          <View style={styles.name}>
            {LETTERS.map((ch, i) => (
              <Letter key={i} ch={ch} i={i} play={play} green={i >= 4} />
            ))}
          </View>
          <Animated.View style={taglineStyle}>
            <T size={15} color="rgba(255,255,255,0.72)" style={{ marginTop: 8, textAlign: 'center' }}>
              Every bill, checked on site.
            </T>
          </Animated.View>
          {status ? (
            <Animated.View style={[styles.status, statusStyle]}>
              <View style={styles.dots}>
                {(status === 'offline' ? [0] : [0, 1, 2]).map((d) => (
                  <Dot key={d} index={d} still={status === 'offline'} />
                ))}
              </View>
              <T size={13} color="rgba(255,255,255,0.85)">
                {status === 'offline' ? 'No signal — you can still add bills' : 'Waking up the server…'}
              </T>
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View style={[styles.footer, { bottom: 26 + insets.bottom }, footerStyle]} pointerEvents="none">
        <T size={11} weight={600} color="rgba(255,255,255,0.5)" style={{ letterSpacing: 1.76, textAlign: 'center' }}>
          KH GROUP · SUSTANIQ
        </T>
      </Animated.View>
    </Animated.View>
  )
}

function Dot({ index, still }: { index: number; still: boolean }) {
  const v = useSharedValue(0)
  useEffect(() => {
    if (still) return
    v.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 440, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 440, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 220 }),
        ),
        -1,
      ),
    )
  }, [index, still, v])
  const style = useAnimatedStyle(() => ({ opacity: still ? 1 : 0.3 + 0.7 * v.value, transform: [{ translateY: -3 * v.value }] }))
  return <Animated.View style={[styles.dot, still && { backgroundColor: '#f0b45a' }, style]} />
}

const styles = StyleSheet.create({
  root: { backgroundColor: NAVY, zIndex: 1000 },
  // Positions are relative to the overlay (centred like the web's CSS), not the window size.
  aura: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -280,
    marginTop: -78 - 280,
    width: 560,
    height: 560,
    borderRadius: 280,
    experimental_backgroundImage: 'radial-gradient(circle, rgba(70, 150, 210, 0.3) 0%, rgba(26, 60, 94, 0) 62%)',
  },
  logo: { position: 'absolute', left: '50%', top: '50%', marginLeft: -LOGO / 2, marginTop: -LOGO / 2, width: LOGO, height: LOGO },
  ripple: { position: 'absolute', borderColor: '#3FB872' },
  text: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: 34, paddingHorizontal: 24, alignItems: 'center' },
  name: { flexDirection: 'row', justifyContent: 'center' },
  letter: { fontFamily: 'IBMPlexSans_700Bold', fontSize: 36, lineHeight: 40, color: colors.white, letterSpacing: -0.72 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86dba6' },
  footer: { position: 'absolute', left: 0, right: 0 },
})
