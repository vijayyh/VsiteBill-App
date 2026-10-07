import Constants from 'expo-constants'
import { router } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useTabBarSpace } from '../components/BottomNav'
import { IconCheck, IconChevronRight, IconClock, IconInfo, IconLock, IconLogOut, IconPhone, type Icon } from '../components/icons'
import { Screen } from '../components/Screen'
import { T } from '../components/T'
import { Card, Field, PageTitle, PrimaryButton, Tap } from '../components/ui'
import { api, ApiError, useApiGet } from '../lib/api'
import { useQueuedUploads } from '../lib/offlineQueue'
import { useSession } from '../lib/session'
import { colors, navyGradient, ring, shadowSoft } from '../lib/theme'

// Same as the web app's Profile screen (frontend/src/screens/common/Profile.tsx).
const ROLE_LABEL = { supervisor: 'Site supervisor', accountant: 'Office / accountant', admin: 'Admin' } as const

function Row({
  icon: IconC,
  label,
  value,
  onPress,
  danger = false,
  chevron = false,
  first = false,
}: {
  icon: Icon
  label: string
  value?: ReactNode
  onPress?: () => void
  danger?: boolean
  chevron?: boolean
  first?: boolean
}) {
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.dangerBg : 'rgba(255,255,255,0.7)' }]}>
        <IconC size={17} stroke={danger ? colors.danger : colors.accent} />
      </View>
      <T size={14} weight={600} color={danger ? colors.danger : colors.ink} style={{ flex: 1 }}>
        {label}
      </T>
      {value !== undefined ? (
        <T size={12.5} color={colors.inkMuted}>
          {value}
        </T>
      ) : null}
      {chevron ? <IconChevronRight size={16} stroke={colors.inkFaint} /> : null}
    </>
  )
  const style = [styles.row, !first && styles.rowDivider]
  return onPress ? (
    <Tap onPress={onPress} style={style}>
      {content}
    </Tap>
  ) : (
    <View style={style}>{content}</View>
  )
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    if (next !== confirm) {
      setError('The two new passwords don’t match')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the password. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
      <Field label="Current password" secureTextEntry value={current} onChangeText={setCurrent} autoComplete="current-password" />
      <Field label="New password" secureTextEntry value={next} onChangeText={setNext} autoComplete="new-password" hint="At least 8 characters" />
      <Field label="Repeat new password" secureTextEntry value={confirm} onChangeText={setConfirm} autoComplete="new-password" />
      {error ? (
        <T size={12.5} weight={600} color={colors.warningText} style={{ marginLeft: 12 }}>
          {error}
        </T>
      ) : null}
      <PrimaryButton onPress={() => void submit()} disabled={busy || !current || !next || !confirm} style={{ paddingVertical: 12 }}>
        <T size={14} weight={700} color={colors.white}>
          {busy ? 'Saving…' : 'Save new password'}
        </T>
      </PrimaryButton>
    </View>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <T size={12} weight={700} color={colors.inkMuted} style={styles.sectionLabel}>
      {children}
    </T>
  )
}

export default function Profile() {
  const space = useTabBarSpace()
  const { user, logout } = useSession()
  const { data } = useApiGet<{ user: { phone: string } }>('/api/auth/me')
  const queued = useQueuedUploads()
  const [changing, setChanging] = useState(false)
  const [changed, setChanged] = useState(false)

  if (!user) return null
  const version = Constants.expoConfig?.version ?? ''

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space }} keyboardShouldPersistTaps="handled">
        <PageTitle title="Profile" />
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <Card style={styles.who}>
            <View style={styles.avatar}>
              <T size={22} weight={700} color={colors.white}>
                {user.initials}
              </T>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={18} weight={700} numberOfLines={1}>
                {user.name}
              </T>
              <T size={12.5} color={colors.inkMuted}>
                {ROLE_LABEL[user.role]}
              </T>
            </View>
          </Card>

          <Card style={{ overflow: 'hidden' }}>
            <Row first icon={IconPhone} label="Phone" value={data?.user.phone ?? '…'} />
            {user.role === 'supervisor' ? <Row icon={IconClock} label="Bills waiting for signal" value={queued.length} /> : null}
          </Card>

          <View>
            <SectionLabel>Security</SectionLabel>
            <Card style={{ overflow: 'hidden' }}>
              <Row
                first
                icon={changed ? IconCheck : IconLock}
                label={changed ? 'Password changed' : 'Change password'}
                onPress={() => {
                  setChanging((v) => !v)
                  setChanged(false)
                }}
                chevron={!changing}
              />
              {changing ? (
                <ChangePassword
                  onDone={() => {
                    setChanging(false)
                    setChanged(true)
                  }}
                />
              ) : null}
            </Card>
            <T size={11.5} lh={1.375} color={colors.inkMuted} style={{ marginTop: 8, marginLeft: 4 }}>
              Forgot it? Log out and use “Forgot password?” — an admin will set a new one for you.
            </T>
          </View>

          <View>
            <SectionLabel>About</SectionLabel>
            <Card style={{ overflow: 'hidden' }}>
              <Row first icon={IconInfo} label="SiteVerify" value={`Version ${version}`} />
            </Card>
          </View>

          <Card style={{ overflow: 'hidden' }}>
            <Row
              first
              icon={IconLogOut}
              label="Log out"
              danger
              onPress={() => {
                logout()
                router.replace('/login')
              }}
            />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.7)' },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...ring(1, 'rgba(255,255,255,0.8)'),
  },
  who: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: navyGradient,
    boxShadow: shadowSoft,
  },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8, marginLeft: 4 },
})
