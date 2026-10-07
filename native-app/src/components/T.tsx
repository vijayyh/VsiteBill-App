import { Text, type TextProps, type TextStyle } from 'react-native'
import { colors, fonts, type Weight } from '../lib/theme'

/**
 * Text in the app font. Sizes are the web app's pixel sizes (1 CSS px = 1 dp), and the default line
 * height is the web's (Tailwind sets 1.5 on the page; `lh` overrides it like leading-* classes do).
 */
export function T({
  size = 14,
  weight = 400,
  color = colors.ink,
  lh = 1.5,
  style,
  ...rest
}: TextProps & { size?: number; weight?: Weight; color?: string; lh?: number }) {
  const base: TextStyle = {
    fontFamily: fonts[weight],
    fontSize: size,
    lineHeight: Math.round(size * lh * 10) / 10,
    color,
    includeFontPadding: false,
  }
  return <Text {...rest} style={[base, style]} />
}
