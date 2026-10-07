import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconBack, IconCheck, IconLock } from '../components/icons'
import { Screen } from '../components/Screen'
import { T } from '../components/T'
import { Card, Field, PrimaryButton, Tap } from '../components/ui'
import { api } from '../lib/api'
import { colors, glassStrong, navyGradient, shadowSoft } from '../lib/theme'

const back = () => (router.canGoBack() ? router.back() : router.replace('/login'))

export default function ForgotPassword() {
  const insets = useSafeAreaInsets()
  const [phone, setPhone] = useState('+91 ')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await api.post('/api/auth/forgot-password', { phone, note })
      setSubmitted(true)
    } catch {
      // Same as the web: the request either goes through or the button can be tried again.
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <Screen>
        <View style={[styles.done, { paddingBottom: 32 + insets.bottom }]}>
          <View style={styles.doneBody}>
            <View style={styles.doneIcon}>
              <IconCheck size={48} stroke={colors.successText} strokeWidth={2.6} />
            </View>
            <T size={24} weight={700} lh={1.25} style={{ textAlign: 'center' }}>
              Request sent
            </T>
            <T size={13.5} lh={1.625} color={colors.inkMuted} style={{ marginTop: 8, textAlign: 'center', maxWidth: 300 }}>
              If that phone number has an account, an admin will reach out to set a new password for you.
            </T>
          </View>
          <PrimaryButton onPress={() => router.replace('/login')} style={{ paddingVertical: 16 }}>
            <T size={15} weight={700} color={colors.white}>
              Back to log in
            </T>
          </PrimaryButton>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <Tap onPress={back} accessibilityLabel="Back to log in" style={[glassStrong, styles.back]}>
            <IconBack size={20} stroke={colors.ink} />
          </Tap>

          <View style={styles.body}>
            <View style={styles.lock}>
              <IconLock size={24} stroke={colors.white} />
            </View>
            <T size={28} weight={700} lh={1.25} style={{ marginTop: 20 }}>
              Forgot your password?
            </T>
            <T size={14} lh={1.625} color={colors.inkMuted} style={{ marginTop: 6, marginBottom: 28 }}>
              Accounts here are set up by an admin. Enter your phone number and an admin will set you a new password.
            </T>

            <View style={{ gap: 16 }}>
              <Field label="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              <Field
                label="Note (optional)"
                multiline
                numberOfLines={2}
                placeholder="Anything the admin should know"
                value={note}
                onChangeText={setNote}
              />
              <PrimaryButton onPress={() => void submit()} disabled={busy} style={{ paddingVertical: 16, marginTop: 4 }}>
                <T size={15} weight={700} color={colors.white}>
                  {busy ? 'Sending…' : 'Send request'}
                </T>
              </PrimaryButton>
            </View>

            <Card style={{ marginTop: 20, paddingHorizontal: 16, paddingVertical: 12 }}>
              <T size={12} lh={1.625} color={colors.inkMuted}>
                No SMS or email is sent. Once an admin sets a temporary password, log in with it and change it from your
                Profile.
              </T>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 1, justifyContent: 'center', paddingVertical: 32 },
  lock: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: navyGradient,
    boxShadow: shadowSoft,
  },
  done: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.successBg,
    boxShadow: shadowSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
})
