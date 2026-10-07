import type { TextStyle, ViewStyle } from 'react-native'

// Design tokens, copied value-for-value from the web app's frontend/src/index.css so both apps
// look the same. Change a value here and in index.css together.
export const colors = {
  bg: '#f5f5f2',
  surface: '#ffffff',
  surfaceAlt: '#ececE8',

  ink: '#1e2320',
  inkMuted: '#6b6f6b',
  inkFaint: '#9ba09b',
  label: '#4c514e',

  border: '#e2e2de',
  borderStrong: '#d8d9d4',

  accent: '#1a3c5e',
  accentLight: '#2f5f8a',
  forest: '#2b5d3e',
  clay: '#8a5300',

  successBg: '#e8f2ec',
  successBorder: '#b7d8c3',
  successText: '#1f6b3a',
  warningBg: '#fdf2e0',
  warningBorder: '#e0ab52',
  warningText: '#8a5300',
  infoBg: '#e9eff6',
  infoBorder: '#bccbdc',
  infoText: '#1a3c5e',
  avatarBg: '#e8ecef',
  danger: '#c23b3b',
  dangerBg: '#fbe9e9',
  badge: '#d64545',

  cameraBg: '#14161a',
  cameraSurface: '#23282c',

  pageTop: '#eaf0f7',
  pageBottom: '#f3eff6',
  white: '#ffffff',
} as const

export const radii = {
  field: 12,
  btn: 12,
  card: 18,
  cta: 20,
  sheet: 24,
  chip: 8,
  full: 999,
} as const

/** Tailwind's `shadow-soft` utility from index.css. */
export const shadowSoft = '0px 1px 2px rgba(26, 60, 94, 0.05), 0px 8px 24px -14px rgba(26, 60, 94, 0.22)'

/**
 * Tailwind's `ring-{width} ring-{color}`: a line drawn just outside the element's edge, following its
 * rounded corners and taking no layout space (a border would sit inside and shrink the element).
 */
export function ring(width: number, color: string) {
  return { outlineWidth: width, outlineStyle: 'solid', outlineColor: color } as const
}

/** `glass`: translucent white panel with a bright hairline edge and a soft drop shadow. */
export const glass = {
  backgroundColor: 'rgba(255, 255, 255, 0.58)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.75)',
  boxShadow: 'inset 0px 1px 0px rgba(255, 255, 255, 0.7), 0px 10px 30px -16px rgba(26, 60, 94, 0.3)',
} as const satisfies ViewStyle

/** `glass-strong`: more opaque, for bars and inputs that need contrast with what scrolls under them. */
export const glassStrong = {
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.85)',
  boxShadow: 'inset 0px 1px 0px rgba(255, 255, 255, 0.8), 0px 10px 30px -16px rgba(26, 60, 94, 0.3)',
} as const satisfies ViewStyle

/** `bg-page`: soft colour patches behind everything (fixed while content scrolls). */
export const pageBackground =
  'radial-gradient(60% 38% at 8% 0%, rgba(47, 95, 138, 0.32), rgba(47, 95, 138, 0) 70%), ' +
  'radial-gradient(48% 32% at 100% 16%, rgba(176, 109, 18, 0.16), rgba(176, 109, 18, 0) 70%), ' +
  'radial-gradient(55% 38% at 0% 72%, rgba(63, 125, 87, 0.16), rgba(63, 125, 87, 0) 70%), ' +
  'radial-gradient(60% 40% at 100% 100%, rgba(122, 96, 176, 0.18), rgba(122, 96, 176, 0) 70%), ' +
  `linear-gradient(180deg, ${colors.pageTop} 0%, ${colors.pageBottom} 100%)`

/** Navy gradient used by avatars, the raised nav button and primary call-outs (`from-[#2f5f8a] to-accent`). */
export const navyGradient = `linear-gradient(to bottom right, ${colors.accentLight}, ${colors.accent})`

/** IBM Plex Sans, as on the web. React Native needs one font family per weight. */
export const fonts = {
  400: 'IBMPlexSans_400Regular',
  500: 'IBMPlexSans_500Medium',
  600: 'IBMPlexSans_600SemiBold',
  700: 'IBMPlexSans_700Bold',
  /** Notes are shown in italic on the web; load the real italic face rather than a slanted fake. */
  italic: 'IBMPlexSans_400Regular_Italic',
} as const
export type Weight = 400 | 500 | 600 | 700

export function font(weight: Weight = 400): TextStyle {
  return { fontFamily: fonts[weight] }
}
