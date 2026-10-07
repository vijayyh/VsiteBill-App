import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '../components/Screen'
import { T } from '../components/T'
import { Tap } from '../components/ui'
import { DEMO_CREDENTIALS, useSession } from '../lib/session'
import { colors, fonts, shadowSoft } from '../lib/theme'

function LoginField({
  label,
  ...input
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false)
  return (
    <View>
      <T size={12.5} weight={600} color={colors.label} style={{ marginBottom: 6, marginLeft: 16 }}>
        {label}
      </T>
      {/* Outline on a wrapper: changing it on the TextInput itself makes Android drop its padding. */}
      <View style={[styles.fieldFrame, focused && styles.fieldFocused]}>
        <TextInput
          {...input}
          underlineColorAndroid="transparent"
          placeholderTextColor={colors.inkFaint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.field}
        />
      </View>
    </View>
  )
}

export default function Login() {
  const { login } = useSession()
  const insets = useSafeAreaInsets()
  const [phone, setPhone] = useState('+91 ')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // A login that takes this long is the free-plan server waking up, not a fault: say so.
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!busy) return
    const timer = setTimeout(() => setSlow(true), 5000)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [busy])

  async function attemptLogin(phoneValue: string, passwordValue: string) {
    setError(null)
    setBusy(true)
    try {
      const user = await login(phoneValue, passwordValue)
      router.replace(`/${user.role}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function handleDemo(role: 'supervisor' | 'accountant') {
    const creds = DEMO_CREDENTIALS[role]
    setPhone(creds.phone)
    void attemptLogin(creds.phone, creds.password)
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Image source={require('../../assets/splash-icon.png')} style={{ width: 44, height: 44 }} />
            </View>
            <View>
              <T size={17} weight={700} lh={1.25}>
                SiteVerify
              </T>
              <T size={12} lh={16 / 12} color={colors.inkMuted} style={{ marginTop: 2 }}>
                KH & Sustaniq sites
              </T>
            </View>
          </View>

          <T size={28} weight={700} lh={1.25}>
            Welcome back
          </T>
          <T size={14} color={colors.inkMuted} style={{ marginTop: 6, marginBottom: 28 }}>
            Log in with the phone number your admin registered.
          </T>

          <View style={{ gap: 16, marginBottom: 22 }}>
            <LoginField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
            <LoginField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="········"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={() => void attemptLogin(phone, password)}
            />

            {error ? (
              <T size={12.5} weight={600} color={colors.warningText} style={{ marginTop: -4, marginLeft: 16 }}>
                {error}
              </T>
            ) : null}

            <Tap onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end', marginTop: -8, marginRight: 8 }} hitSlop={8}>
              <T size={12.5} weight={600} color={colors.accent}>
                Forgot password?
              </T>
            </Tap>

            <Tap onPress={() => void attemptLogin(phone, password)} disabled={busy} style={[styles.submit, busy && { opacity: 0.6 }]}>
              <T size={15} weight={700} color={colors.white}>
                {busy ? 'Logging in…' : 'Log in'}
              </T>
            </Tap>
            {slow ? (
              <T size={12.5} lh={1.375} color={colors.inkMuted} style={{ textAlign: 'center', marginTop: -4 }} accessibilityRole="text">
                The server is waking up. The first login of the day can take up to a minute.
              </T>
            ) : null}
          </View>

          <View style={styles.divider}>
            <View style={styles.rule} />
            <T size={11} weight={600} color={colors.inkFaint}>
              OR TRY A DEMO ROLE
            </T>
            <View style={styles.rule} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Tap onPress={() => handleDemo('supervisor')} disabled={busy} style={[styles.demo, busy && { opacity: 0.6 }]}>
              <T size={12.5} weight={600}>
                Site Supervisor
              </T>
            </Tap>
            <Tap onPress={() => handleDemo('accountant')} disabled={busy} style={[styles.demo, busy && { opacity: 0.6 }]}>
              <T size={12.5} weight={600}>
                Office / Accountant
              </T>
            </Tap>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  logo: { width: 44, height: 44, borderRadius: 10, boxShadow: '0px 6px 10px rgba(26, 60, 94, 0.28)' },
  field: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontFamily: fonts[400],
    fontSize: 14.5,
    color: colors.ink,
  },
  fieldFrame: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadowSoft,
  },
  fieldFocused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.accent, outlineOffset: 1 },
  submit: {
    marginTop: 4,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    boxShadow: shadowSoft,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  rule: { flex: 1, height: 1, backgroundColor: colors.borderStrong },
  demo: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: shadowSoft,
  },
})
