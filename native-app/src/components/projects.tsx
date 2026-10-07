import { router, type Href } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { GRADIENT } from '../lib/projectColors'
import { STATUS_META } from '../lib/status'
import { colors, glass, radii, ring } from '../lib/theme'
import type { ProjectAccent, ProjectSummary } from '../lib/types'
import { Frost, FrostBackdrop, FrostScope } from './Frost'
import { IconBack } from './icons'
import { T } from './T'
import { Tap } from './ui'

// Native versions of ProjectCard (with its skyline), ProjectCounts and ProjectHero.

/** A white-on-colour site skyline, standing in for a project photo. */
export function Skyline({ height }: { height: number }) {
  return (
    // The 25% opacity sits on a wrapper: set on the Svg itself it is applied twice (comes out ~6%).
    <View pointerEvents="none" style={styles.skyline}>
      <Svg viewBox="0 0 200 80" width={height * 2.5} height={height} fill="white">
        <Rect x="10" y="38" width="22" height="42" />
        <Rect x="36" y="22" width="26" height="58" />
        <Rect x="66" y="46" width="18" height="34" />
        <Rect x="88" y="12" width="30" height="68" />
        <Rect x="122" y="30" width="20" height="50" />
        <Rect x="146" y="40" width="26" height="40" />
        <Path d="M150 40 L150 4 L196 4 L196 8 L154 8 L154 40 Z" />
        <Rect x="186" y="8" width="2" height="16" />
        <Rect x="182" y="24" width="10" height="7" />
      </Svg>
    </View>
  )
}

/** Colour "hero" card for a project, in place of a building photo. */
export function ProjectCard({
  to,
  code,
  name,
  accent,
  footer,
  style,
}: {
  to: Href
  code: string
  name: string
  accent: ProjectAccent
  footer?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Tap onPress={() => router.push(to)} style={[glass, styles.card, style]}>
      <View style={[styles.cardHero, { experimental_backgroundImage: GRADIENT[accent] }]}>
        <Skyline height={104 * 0.78} />
        <T size={11} weight={600} color="rgba(255,255,255,0.8)" style={{ letterSpacing: 0.275 }}>
          {code}
        </T>
        <T size={16} weight={700} color={colors.white} lh={1.375} numberOfLines={2} style={{ marginTop: 2, paddingRight: 64 }}>
          {name}
        </T>
      </View>
      {footer ? <View style={styles.cardFooter}>{footer}</View> : null}
    </Tap>
  )
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <T size={10.5} weight={700} color={color} numberOfLines={1}>
        {label}
      </T>
    </View>
  )
}

/** "2 pending · 3 flagged" chips for a project, or "All matched" / "No bills yet". */
export function ProjectCounts({ project }: { project: ProjectSummary }) {
  const { pendingCount, flaggedCount, matchedCount } = project
  const pending = STATUS_META.PENDING
  const flagged = STATUS_META.REVIEW
  const matched = STATUS_META.MATCHED

  if (pendingCount === 0 && flaggedCount === 0) {
    return (
      <View style={styles.chips}>
        {matchedCount > 0 ? (
          <Chip label={`All ${matchedCount} matched`} color={matched.text} bg={matched.bg} />
        ) : (
          <Chip label="No bills yet" color={colors.inkMuted} bg="rgba(255,255,255,0.7)" />
        )}
      </View>
    )
  }
  return (
    <View style={styles.chips}>
      {pendingCount > 0 ? <Chip label={`${pendingCount} pending`} color={pending.text} bg={pending.bg} /> : null}
      {flaggedCount > 0 ? <Chip label={`${flaggedCount} flagged`} color={flagged.text} bg={flagged.bg} /> : null}
      {matchedCount > 0 ? <Chip label={`${matchedCount} matched`} color={matched.text} bg={matched.bg} /> : null}
    </View>
  )
}

/** Count shown in the hero's frosted strip, e.g. "3 / Pending". */
export interface HeroStat {
  value: ReactNode
  label: string
}

// The hero's frosted pieces: white tints over an 8 px blur of the colour and skyline behind them
// (web: bg-white/20 or /15 with backdrop-blur).
const HERO_FROST = { blur: 8, tint: 'rgba(255, 255, 255, 0.2)' }

/** Small frosted pill for the hero's top-right corner (put it in ProjectHero's `action`). */
export function HeroPill({ children, ...props }: PressableProps & { children: ReactNode }) {
  return (
    <Tap {...props} style={styles.heroPill}>
      <Frost {...HERO_FROST} style={{ borderRadius: radii.full }} />
      {children}
    </Tap>
  )
}

/**
 * Colour header for a project's own screen: the project's colour and skyline, a back button,
 * the code and name, an optional action (e.g. a Drive link) and a strip of counts.
 */
export function ProjectHero({
  onBack,
  code,
  name,
  accent,
  action,
  stats,
}: {
  onBack: () => void
  code?: string
  name?: string
  accent?: ProjectAccent
  action?: ReactNode
  stats?: HeroStat[]
}) {
  // The skyline is 78% of the header's height (as on the web), which depends on the name's length.
  const [height, setHeight] = useState(0)
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
      <View onLayout={(e) => setHeight(e.nativeEvent.layout.height)} style={styles.hero}>
        <FrostScope>
          {/* The colour and skyline, which the frosted pieces below blur. (The gradient is on an inner
              view: the backdrop view doesn't draw background images.) */}
          <FrostBackdrop style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: GRADIENT[accent ?? 'accent'] }]} />
            {height > 0 ? <Skyline height={height * 0.78} /> : null}
          </FrostBackdrop>
          <View style={styles.heroTop}>
            <Tap onPress={onBack} accessibilityLabel="Go back" style={styles.heroBack}>
              <Frost {...HERO_FROST} style={{ borderRadius: 20 }} />
              <IconBack size={20} stroke={colors.white} />
            </Tap>
            {action}
          </View>
          <View style={{ marginTop: 20, minHeight: 52 }}>
            <T size={11.5} weight={600} color="rgba(255,255,255,0.8)" style={{ letterSpacing: 0.29 }}>
              {code}
            </T>
            <T size={21} weight={700} color={colors.white} lh={1.375} numberOfLines={2} style={{ marginTop: 2, paddingRight: 40 }}>
              {name}
            </T>
          </View>
          {stats && stats.length > 0 ? (
            <View style={styles.heroStats}>
              <Frost blur={8} tint="rgba(255, 255, 255, 0.15)" style={{ borderRadius: 16 }} />
              {stats.map((stat, i) => (
                <View key={stat.label} style={[styles.heroStat, i > 0 && styles.heroStatDivider]}>
                  <T size={17} weight={700} color={colors.white} lh={1} style={{ textAlign: 'center' }}>
                    {stat.value}
                  </T>
                  <T size={10.5} weight={500} color="rgba(255,255,255,0.85)" style={{ marginTop: 4, textAlign: 'center' }}>
                    {stat.label}
                  </T>
                </View>
              ))}
            </View>
          ) : null}
        </FrostScope>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  skyline: { position: 'absolute', right: 0, bottom: 0, opacity: 0.25 },
  card: { borderRadius: radii.card, overflow: 'hidden' },
  cardHero: {
    height: 104,
    margin: 6,
    marginBottom: 0,
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardFooter: { paddingHorizontal: 16, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    ...ring(1, 'rgba(255,255,255,0.7)'),
  },
  hero: {
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    boxShadow: '0px 18px 36px -20px rgba(26, 60, 94, 0.9)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    ...ring(1, 'rgba(255,255,255,0.4)'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: 16,
    borderRadius: 16,
    ...ring(1, 'rgba(255,255,255,0.3)'),
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.full,
    ...ring(1, 'rgba(255,255,255,0.4)'),
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroStat: { flex: 1, paddingHorizontal: 8, paddingVertical: 8 },
  heroStatDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.25)' },
})
