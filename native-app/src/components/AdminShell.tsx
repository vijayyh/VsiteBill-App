import { forwardRef, useState, type ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { colors, fonts, glassStrong } from '../lib/theme'
import { useTabBarSpace } from './BottomNav'
import { BellButton } from './headers'
import { Screen } from './Screen'
import { T } from './T'
import { PageTitle } from './ui'

/**
 * The admin forms' compact field (web: 11.5 px label with no indent over a 13.5 px input with 14 px
 * corners), smaller than the main forms' Field. The outline sits on the wrapper: changing it on the
 * TextInput itself makes Android drop the input's padding.
 */
export const AdminField = forwardRef<TextInput, { label: string } & TextInputProps>(function AdminField({ label, ...input }, ref) {
  const [focused, setFocused] = useState(false)
  return (
    <View>
      <T size={11.5} weight={600} color={colors.label} style={{ marginBottom: 4 }}>
        {label}
      </T>
      <View style={[glassStrong, styles.frame, focused && styles.focused]}>
        <TextInput
          ref={ref}
          {...input}
          underlineColorAndroid="transparent"
          placeholderTextColor={colors.inkFaint}
          onFocus={(e) => {
            setFocused(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            input.onBlur?.(e)
          }}
          style={styles.input}
        />
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  frame: { borderRadius: 14 },
  focused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'rgba(26, 60, 94, 0.4)' },
  // 13.5 px text on 1.5 line height plus 10 px top and bottom padding, as the web's input.
  input: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 20.25 + 20, fontFamily: fonts[400], fontSize: 13.5, color: colors.ink },
})

/** Frame for the admin tabs: big title with the alerts bell, content, bottom nav (web: AdminShell). */
export const AdminShell = forwardRef<
  ScrollView,
  { title: string; subtitle?: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void }
>(function AdminShell({ title, subtitle = 'Admin', children, refreshing = false, onRefresh }, ref) {
  const space = useTabBarSpace()
  return (
    <Screen>
      <ScrollView
        ref={ref}
        contentContainerStyle={{ paddingBottom: space }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} /> : undefined}
      >
        <PageTitle title={title} subtitle={subtitle} right={<BellButton />} />
        <View style={{ paddingHorizontal: 20 }}>{children}</View>
      </ScrollView>
    </Screen>
  )
})
