import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, glassStrong } from '../lib/theme'
import { IconCheck, IconChevronRight } from './icons'
import { T } from './T'
import { Tap } from './ui'

/**
 * The native counterpart of the web's <select>: a frosted field showing the current choice; tapping
 * it opens a sheet of options (as Chrome does for a select on Android).
 */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
}: {
  label?: string
  value: V
  options: { value: V; label: string }[]
  onChange: (value: V) => void
  disabled?: boolean
  compact?: boolean
}) {
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)?.label ?? ''

  return (
    <View>
      {label ? (
        <T size={11.5} weight={600} color={colors.label} style={{ marginBottom: 4 }}>
          {label}
        </T>
      ) : null}
      <Tap
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={[glassStrong, styles.field, compact && { paddingHorizontal: 12 }, disabled && { opacity: 0.6 }]}
        accessibilityRole="button"
      >
        {/* A select's text uses the font's natural line height (about 1.4), not the page's 1.5. */}
        <T size={compact ? 12.5 : 13.5} lh={1.4} numberOfLines={1} style={{ flex: 1 }}>
          {current}
        </T>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <IconChevronRight size={16} stroke={colors.inkMuted} />
        </View>
      </Tap>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheetWrap, { paddingBottom: 12 + insets.bottom }]}>
          {/* Solid, like the system dialog a web <select> opens on Android, so the page can't show through. */}
          <View style={styles.sheet}>
            {label ? (
              <T size={13} weight={700} color={colors.inkMuted} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                {label}
              </T>
            ) : null}
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((option) => {
                const selected = option.value === value
                return (
                  <Tap
                    key={option.value}
                    onPress={() => {
                      setOpen(false)
                      if (!selected) onChange(option.value)
                    }}
                    style={styles.option}
                  >
                    <T size={14.5} weight={selected ? 700 : 400} color={selected ? colors.accent : colors.ink} style={{ flex: 1 }}>
                      {option.label}
                    </T>
                    {selected ? <IconCheck size={18} stroke={colors.accent} strokeWidth={2.4} /> : null}
                  </Tap>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30, 35, 32, 0.35)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  sheet: { borderRadius: 24, paddingBottom: 8, overflow: 'hidden', backgroundColor: colors.white, boxShadow: '0px 10px 30px -16px rgba(26, 60, 94, 0.3)' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
})
