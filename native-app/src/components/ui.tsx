import { router, type Href } from 'expo-router'
import { useState, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { colors, fonts, glass, glassStrong, radii, ring } from '../lib/theme'
import { IconSearch, type Icon } from './icons'
import { T } from './T'

// Native versions of the web app's shared UI (frontend/src/components/ui.tsx), same sizes and colours.

/** Frosted-glass card. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[glass, { borderRadius: radii.card }, style]}>{children}</View>
}

/** A Pressable that dims slightly while pressed (the app's standard tap feedback). */
export function Tap({ style, ...props }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return <Pressable {...props} style={({ pressed }) => [style, pressed && !props.disabled && { opacity: 0.82 }]} />
}

/** Big title row for a tab screen that doesn't use the greeting header. */
export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={s.pageTitle}>
      <View style={{ flexShrink: 1 }}>
        <T size={24} weight={700} lh={1.25}>
          {title}
        </T>
        {subtitle ? (
          <T size={12.5} color={colors.inkMuted} style={{ marginTop: 4 }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  )
}

export function SectionTitle({ title, to, linkLabel = 'See all' }: { title: string; to?: Href; linkLabel?: string }) {
  return (
    <View style={s.sectionTitle}>
      <T size={15} weight={700}>
        {title}
      </T>
      {to ? (
        <Tap onPress={() => router.push(to)} hitSlop={8}>
          <T size={12} weight={600} color={colors.accent}>
            {linkLabel}
          </T>
        </Tap>
      ) : null}
    </View>
  )
}

export function StatTile({ value, label, icon: IconC, tint }: { value: ReactNode; label: string; icon: Icon; tint: { bg: string; fg: string } }) {
  return (
    <Card style={{ padding: 12, flex: 1 }}>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={[s.tileIcon, { backgroundColor: tint.bg }]}>
          <IconC size={14} stroke={tint.fg} strokeWidth={2.4} />
        </View>
      </View>
      <T size={24} weight={700} lh={1} style={{ marginTop: 4 }}>
        {value}
      </T>
      <T size={11} color={colors.inkMuted} lh={1.25} style={{ marginTop: 6 }}>
        {label}
      </T>
    </Card>
  )
}

export interface TabOption<K extends string> {
  key: K
  label: string
  count?: number
  /** Colour of the dot shown before the label (status tabs). */
  dot?: string
}

/** Pill filter tabs: the active one is solid navy, the rest are frosted pills with a fine edge. */
export function FilterTabs<K extends string>({
  tabs,
  value,
  onChange,
  inset = 20,
}: {
  tabs: TabOption<K>[]
  value: K
  onChange: (key: K) => void
  inset?: number
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: inset, paddingVertical: 4 }}
    >
      {tabs.map((tab) => {
        const active = tab.key === value
        return (
          <Tap key={tab.key} onPress={() => onChange(tab.key)} style={[s.pill, active ? s.pillActive : s.pillIdle]}>
            {tab.dot ? <View style={[s.dot, { backgroundColor: active ? colors.white : tab.dot }]} /> : null}
            <T size={12.5} weight={600} color={active ? colors.white : colors.inkMuted}>
              {tab.label}
            </T>
            {tab.count !== undefined ? (
              <View style={[s.pillCount, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)' }]}>
                <T size={11} weight={700} lh={18 / 11} color={active ? colors.white : colors.ink} style={{ textAlign: 'center' }}>
                  {tab.count}
                </T>
              </View>
            ) : null}
          </Tap>
        )
      })}
    </ScrollView>
  )
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <View style={[glassStrong, s.search]}>
      <IconSearch size={17} stroke={colors.inkMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        style={s.searchInput}
        returnKeyType="search"
      />
      {value ? (
        <Tap onPress={() => onChange('')} hitSlop={8}>
          <T size={12} weight={600} color={colors.inkMuted}>
            Clear
          </T>
        </Tap>
      ) : null}
    </View>
  )
}

/** Labelled text input in the frosted pill style. */
export function Field({
  label,
  invalid = false,
  hint,
  multiline,
  style,
  ...input
}: { label: ReactNode; invalid?: boolean; hint?: ReactNode } & TextInputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[multiline && s.textareaGap, style as StyleProp<ViewStyle>]}>
      <View style={s.fieldLabel}>
        {typeof label === 'string' ? (
          <T size={12} weight={600} color={colors.label}>
            {label}
          </T>
        ) : (
          label
        )}
      </View>
      {/* The frosted box and its focus / missing outline are drawn by a wrapper: changing the outline on
          the TextInput itself makes Android drop the input's padding. Focus wins over "missing", as on the web. */}
      <View style={[glassStrong, s.inputFrame, focused ? s.inputFocused : invalid ? s.inputInvalid : null]}>
        <TextInput
          {...input}
          multiline={multiline}
          placeholderTextColor={colors.inkFaint}
          onFocus={(e) => {
            setFocused(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            input.onBlur?.(e)
          }}
          underlineColorAndroid="transparent"
          style={[s.input, multiline && s.inputMultiline]}
        />
      </View>
      {hint ? (
        <T size={11.5} color={colors.inkMuted} style={{ marginTop: 4, marginLeft: 12 }}>
          {hint}
        </T>
      ) : null}
    </View>
  )
}

export function EmptyState({ icon: IconC, title, body }: { icon: Icon; title: string; body?: ReactNode }) {
  return (
    <Card style={s.empty}>
      <View style={s.emptyIcon}>
        <IconC size={22} stroke={colors.inkMuted} />
      </View>
      <T size={14} weight={700} style={{ marginTop: 12, textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T size={12.5} color={colors.inkMuted} lh={1.625} style={{ marginTop: 4, textAlign: 'center', maxWidth: 260 }}>
          {body}
        </T>
      ) : null}
    </Card>
  )
}

/** The web's `btnPrimary`: navy pill with a soft navy shadow. */
export function PrimaryButton({
  children,
  style,
  disabled,
  ...props
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Tap {...props} disabled={disabled} style={[s.btnPrimary, disabled && { opacity: 0.6 }, style]}>
      {children}
    </Tap>
  )
}

/** The web's `btnSecondary`: frosted pill. */
export function SecondaryButton({
  children,
  style,
  disabled,
  ...props
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Tap {...props} disabled={disabled} style={[glass, s.btnSecondary, disabled && { opacity: 0.6 }, style]}>
      {children}
    </Tap>
  )
}

export const s = StyleSheet.create({
  pageTitle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...ring(1, 'rgba(255,255,255,0.8)'),
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 7 },
  pillActive: {
    backgroundColor: colors.accent,
    ...ring(1, colors.accent),
    boxShadow: '0px 8px 18px -10px rgba(26, 60, 94, 0.8)',
  },
  pillIdle: glass,
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillCount: { minWidth: 20, borderRadius: radii.full, paddingHorizontal: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radii.full, paddingHorizontal: 16, height: 48 },
  searchInput: { flex: 1, fontFamily: fonts[400], fontSize: 14, color: colors.ink, paddingVertical: 0 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginLeft: 12 },
  input: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts[400],
    fontSize: 14.5,
    color: colors.ink,
  },
  // The web's two-row textarea: 14 px text, two 1.5 line-height rows plus the 12 px top and bottom padding.
  inputMultiline: { fontSize: 14, lineHeight: 21, minHeight: 2 * 21 + 24, textAlignVertical: 'top' },
  // A browser leaves 6.4 px under a textarea (it sits on the text baseline); keep the same space.
  textareaGap: { marginBottom: 6.4 },
  inputFrame: { borderRadius: 16 },
  inputFocused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'rgba(26, 60, 94, 0.4)' },
  inputInvalid: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'rgba(138, 83, 0, 0.7)' },
  empty: { paddingHorizontal: 20, paddingVertical: 28, alignItems: 'center' },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.7)',
    ...ring(1, colors.white),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    boxShadow: '0px 10px 24px -12px rgba(26, 60, 94, 0.7)',
  },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radii.full },
})
