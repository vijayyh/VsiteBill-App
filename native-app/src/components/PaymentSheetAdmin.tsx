import { useState } from 'react'
import { Linking, StyleSheet, TextInput, View } from 'react-native'
import { api, ApiError, useApiGet } from '../lib/api'
import { colors, fonts, glass, glassStrong, shadowSoft } from '../lib/theme'
import type { PaymentSheetStatus } from '../lib/types'
import { IconCheck } from './icons'
import { T } from './T'
import { PrimaryButton, Tap } from './ui'

// Same as the web app's admin payment-sheet card (frontend/src/components/PaymentSheetAdmin.tsx):
// which Google Sheet bills approved for payment go to, written through the Google account
// connected for Drive (which also needs Sheets access).

export function PaymentSheetAdmin({ onReconnect, reconnecting }: { onReconnect: () => Promise<void>; reconnecting: boolean }) {
  const sheetStatus = useApiGet<PaymentSheetStatus>('/api/payment-sheet')
  const status = sheetStatus.data
  const [link, setLink] = useState('')
  const [focused, setFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/payment-sheet', { link })
      setLink('')
      sheetStatus.refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    await api.delete('/api/payment-sheet').catch(() => {})
    sheetStatus.refetch()
  }

  return (
    <>
      <T size={12} weight={700} lh={16 / 12} color={colors.inkMuted} style={styles.sectionLabel}>
        Payment sheet
      </T>
      <View style={[glass, styles.card]}>
        {!status ? (
          <T size={13} color={colors.inkMuted}>
            Loading…
          </T>
        ) : null}

        {status && !status.googleConnected ? (
          <T size={13} lh={1.625} color={colors.inkMuted}>
            Connect Google Drive above first: the payment sheet is written through the same Google account.
          </T>
        ) : null}

        {status?.googleConnected && !status.sheetsAllowed ? (
          <View>
            <T size={13} lh={1.625} color={colors.inkMuted} style={{ marginBottom: 10 }}>
              To add approved bills to a Google Sheet, {status.googleEmail} needs to allow one more permission (Google Sheets).
              Connect it again and tick the new permission.
            </T>
            <PrimaryButton
              onPress={() => void onReconnect().then(() => sheetStatus.refetch())}
              disabled={reconnecting}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, boxShadow: shadowSoft }}
            >
              <T size={12.5} weight={700} color={colors.white}>
                {reconnecting ? 'Connecting…' : 'Reconnect Google'}
              </T>
            </PrimaryButton>
          </View>
        ) : null}

        {status?.googleConnected && status.sheetsAllowed && status.sheet ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={styles.okIcon}>
              <IconCheck size={16} stroke={colors.successText} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={13.5} weight={700} numberOfLines={1}>
                {status.sheet.title}
              </T>
              <T size={12} lh={16 / 12} color={colors.inkMuted} style={{ marginTop: 2 }}>
                Tab “{status.sheet.tabTitle}”{status.sheet.connectedBy ? ` · connected by ${status.sheet.connectedBy}` : ''}
              </T>
              <Tap onPress={() => void Linking.openURL(status.sheet!.url)} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                <T size={12.5} weight={600} color={colors.accent}>
                  Open payment sheet ↗
                </T>
              </Tap>
              <T size={11} lh={1.375} color={colors.inkFaint} style={{ marginTop: 6 }}>
                Accountants add matched bills here with “Approve for payment”. The app never writes Status or Pay Receipts: those are the
                payment manager’s.
              </T>
              <Tap onPress={() => void disconnect()} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                <T size={12} weight={600} color={colors.warningText}>
                  Disconnect
                </T>
              </Tap>
            </View>
          </View>
        ) : null}

        {status?.googleConnected && status.sheetsAllowed && !status.sheet ? (
          <View>
            <T size={13} lh={1.625} color={colors.inkMuted} style={{ marginBottom: 10 }}>
              Paste the link of the payment register. {status.googleEmail} must be able to edit it (share it with that account as an
              Editor).
            </T>
            {/* Outline on a wrapper: changing it on the TextInput itself makes Android drop its padding. */}
            <View style={[glassStrong, styles.inputFrame, focused && styles.inputFocused]}>
              <TextInput
                value={link}
                onChangeText={setLink}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel="Payment sheet link"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                underlineColorAndroid="transparent"
                style={styles.input}
              />
            </View>
            {error ? (
              <T size={12} weight={600} color={colors.warningText} style={{ marginTop: 8 }}>
                {error}
              </T>
            ) : null}
            <PrimaryButton
              onPress={() => void connect()}
              disabled={saving || !link.trim()}
              style={{ alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, boxShadow: shadowSoft }}
            >
              <T size={12.5} weight={700} color={colors.white}>
                {saving ? 'Checking the sheet…' : 'Connect sheet'}
              </T>
            </PrimaryButton>
          </View>
        ) : null}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 },
  card: { borderRadius: 18, padding: 16, marginBottom: 20 },
  okIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  inputFrame: { borderRadius: 14 },
  inputFocused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'rgba(26, 60, 94, 0.4)' },
  input: { paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts[400], fontSize: 12.5, color: colors.ink },
})
