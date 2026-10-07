import { Redirect, router } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { Screen } from '../components/Screen'
import { T } from '../components/T'
import { Tap } from '../components/ui'
import { markWelcomeSeen, useWelcomeSeen } from '../lib/flags'
import { useSession } from '../lib/session'
import { colors, shadowSoft } from '../lib/theme'

/** Site skyline, tower crane and a checked bill — the same drawing as the web's welcome screen. */
function SiteIllustration() {
  return (
    <Svg viewBox="0 0 320 300" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2f5f8a" />
          <Stop offset="1" stopColor="#1a3c5e" />
        </LinearGradient>
      </Defs>
      <Rect width="320" height="300" fill="url(#sky)" />
      <Circle cx="252" cy="62" r="26" fill="#ffffff" opacity={0.12} />
      <G fill="#ffffff" opacity={0.14}>
        <Rect x="18" y="150" width="40" height="150" />
        <Rect x="64" y="118" width="46" height="182" />
        <Rect x="116" y="170" width="34" height="130" />
        <Rect x="226" y="134" width="44" height="166" />
        <Rect x="274" y="176" width="34" height="124" />
      </G>
      <G stroke="#ffffff" strokeWidth={3} opacity={0.55} fill="none" strokeLinecap="round">
        <Path d="M196 300 V70" />
        <Path d="M206 300 V70" />
        <Path d="M196 90 L206 110 M206 110 L196 130 M196 130 L206 150 M206 150 L196 170 M196 170 L206 190" />
        <Path d="M120 70 H300" />
        <Path d="M201 70 L201 46 L120 70 M201 46 L300 70" />
        <Path d="M268 70 V108" />
      </G>
      <Rect x="258" y="108" width="20" height="14" rx="2" fill="#e0ab52" opacity={0.9} />
      <G transform="translate(58 150) rotate(-6)">
        <Rect width="128" height="112" rx="14" fill="#ffffff" />
        <Rect x="16" y="18" width="62" height="8" rx="4" fill="#1a3c5e" />
        <Rect x="16" y="36" width="96" height="6" rx="3" fill="#d8dce3" />
        <Rect x="16" y="50" width="80" height="6" rx="3" fill="#d8dce3" />
        <Rect x="16" y="64" width="88" height="6" rx="3" fill="#d8dce3" />
        <Rect x="16" y="84" width="44" height="10" rx="5" fill="#e8f2ec" />
      </G>
      <Circle cx="184" cy="246" r="24" fill="#1f6b3a" stroke="#ffffff" strokeWidth={4} />
      <Path d="M173 246 l8 8 l15 -16" stroke="#ffffff" strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** First-open screen. Returning visitors (or logged-in users) skip straight past it. */
export default function Welcome() {
  const { user } = useSession()
  const seen = useWelcomeSeen()
  const insets = useSafeAreaInsets()

  if (user) return <Redirect href={`/${user.role}`} />
  if (seen === null) return <Screen>{null}</Screen>
  if (seen) return <Redirect href="/login" />

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.card}>
          <View style={styles.art}>
            <SiteIllustration />
          </View>
          <View style={styles.cardText}>
            <T size={30} weight={700} lh={1.1} color={colors.white}>
              Every bill,{'\n'}checked on site.
            </T>
            <T size={14} lh={1.625} color="rgba(255,255,255,0.8)" style={{ marginTop: 12 }}>
              Photograph delivery bills even without signal. The office matches them against purchase orders, and every
              bill is archived by project.
            </T>
          </View>
        </View>

        <Tap
          onPress={() => {
            markWelcomeSeen()
            router.replace('/login')
          }}
          style={styles.cta}
        >
          <T size={15} weight={700} color={colors.white}>
            Get started
          </T>
        </Tap>
        <View style={styles.footer}>
          <T size={13} color={colors.inkMuted}>
            Already have an account?{' '}
          </T>
          <Tap
            onPress={() => {
              markWelcomeSeen()
              router.replace('/login')
            }}
            hitSlop={8}
          >
            <T size={13} weight={700}>
              Log in
            </T>
          </Tap>
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: { flexGrow: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#1a3c5e', boxShadow: shadowSoft },
  art: { flexGrow: 1, minHeight: 260, overflow: 'hidden' },
  cardText: { paddingHorizontal: 24, paddingBottom: 28, paddingTop: 20 },
  cta: { marginTop: 20, paddingVertical: 16, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14 },
})
