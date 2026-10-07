import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useRef, useState } from 'react'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'
import { AdminShell } from '../../../components/AdminShell'
import { IconAlertTriangle, IconCheck } from '../../../components/icons'
import { SelectField } from '../../../components/SelectField'
import { T } from '../../../components/T'
import { PrimaryButton, Tap } from '../../../components/ui'
import { api, useApiGet } from '../../../lib/api'
import { colors, glass, radii, shadowSoft } from '../../../lib/theme'
import type { AdminOverview, DriveStatus, PasswordResetRequest, SharedDrive } from '../../../lib/types'

// Same as the web app's admin Overview (frontend/src/screens/admin/Dashboard.tsx).
function SectionLabel({ children }: { children: string }) {
  return (
    <T size={12} weight={700} lh={16 / 12} color={colors.inkMuted} style={{ textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 }}>
      {children}
    </T>
  )
}

/** One of the four count tiles; the password-reset one is amber. */
function Tile({ onPress, value, label, warn = false }: { onPress: () => void; value: string | number; label: string; warn?: boolean }) {
  return (
    <Tap onPress={onPress} style={[warn ? styles.warnTile : glass, styles.tile]}>
      <T size={20} weight={700} lh={1.4} color={warn ? colors.warningText : colors.ink}>
        {value}
      </T>
      <T size={11} color={warn ? colors.warningText : colors.inkMuted} style={{ marginTop: 2 }}>
        {label}
      </T>
    </Tap>
  )
}

export default function AdminOverviewScreen() {
  const scroll = useRef<ScrollView>(null)
  const [notificationsY, setNotificationsY] = useState(0)
  const overview = useApiGet<AdminOverview>('/api/admin/overview')
  const resets = useApiGet<{ requests: PasswordResetRequest[] }>('/api/admin/password-resets')
  const drive = useApiGet<DriveStatus>('/api/admin/drive/status')
  const sharedDrives = useApiGet<{ sharedDrives: SharedDrive[] }>(drive.data?.connected ? '/api/admin/drive/shared-drives' : null)
  const [resolving, setResolving] = useState<number | null>(null)
  // Requests resolved on this screen, kept (with their new password) after they leave the pending
  // list, so the admin can still read the password out until they tap Done.
  const [resolved, setResolved] = useState<{ request: PasswordResetRequest; password: string }[]>([])
  const [connecting, setConnecting] = useState(false)
  const [settingDrive, setSettingDrive] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)

  const stillPending = resets.data?.requests ?? []
  const pending = [...stillPending, ...resolved.map((r) => r.request).filter((req) => !stillPending.some((p) => p.id === req.id))]
  const passwordFor = (id: number) => resolved.find((r) => r.request.id === id)?.password
  const driveStatus = drive.data
  const counts = overview.data

  async function connectDrive() {
    setConnecting(true)
    setDriveError(null)
    try {
      const res = await api.get<{ authUrl: string }>('/api/admin/drive/connect')
      // Google's sign-in runs in a browser tab; when it's closed, check whether it connected.
      await WebBrowser.openBrowserAsync(res.authUrl)
      drive.refetch()
    } catch {
      setDriveError('Could not start the Google connection. Try again.')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnectDrive() {
    await api.post('/api/admin/drive/disconnect').catch(() => {})
    drive.refetch()
  }

  async function chooseSharedDrive(id: string) {
    setSettingDrive(true)
    setDriveError(null)
    try {
      const selected = sharedDrives.data?.sharedDrives.find((d) => d.id === id)
      await api.post('/api/admin/drive/shared-drive', { id: id || null, name: selected?.name ?? null })
      drive.refetch()
    } catch {
      setDriveError('Could not switch the Drive location. Try again.')
    } finally {
      setSettingDrive(false)
    }
  }

  async function resolve(requestId: number) {
    setResolving(requestId)
    try {
      const res = await api.post<{ temporaryPassword: string; request: PasswordResetRequest }>(`/api/admin/password-resets/${requestId}/resolve`)
      setResolved((prev) => [...prev, { request: res.request, password: res.temporaryPassword }])
      overview.refetch()
      resets.refetch()
    } catch {
      // Leave the button to try again.
    } finally {
      setResolving(null)
    }
  }

  return (
    <AdminShell
      ref={scroll}
      title="Overview"
      refreshing={overview.refreshing}
      onRefresh={() => {
        overview.refresh()
        resets.refetch()
        drive.refetch()
      }}
    >
      <SectionLabel>Google Drive</SectionLabel>
      <View style={[glass, styles.driveCard]}>
        {driveError ? (
          <T size={12} weight={600} color={colors.warningText} style={{ marginBottom: 8 }}>
            {driveError}
          </T>
        ) : null}

        {driveStatus && !driveStatus.configured ? (
          <T size={13} color={colors.inkMuted}>
            Not set up yet — Google API credentials need to be added on the server first.
          </T>
        ) : null}

        {driveStatus?.configured && driveStatus.connected && driveStatus.account ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={styles.okIcon}>
              <IconCheck size={16} stroke={colors.successText} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <T size={13.5} weight={700}>
                Connected as {driveStatus.account.email}
              </T>
              <T size={12} lh={16 / 12} color={colors.inkMuted} style={{ marginTop: 2 }}>
                Connected by {driveStatus.account.connectedBy}
              </T>

              <View style={{ marginTop: 10 }}>
                <SelectField
                  compact
                  label="Save bill photos to"
                  value={driveStatus.account.sharedDriveId ?? ''}
                  disabled={settingDrive}
                  onChange={(id) => void chooseSharedDrive(id)}
                  options={[
                    { value: '', label: `My Drive (personal — ${driveStatus.account.email})` },
                    ...(sharedDrives.data?.sharedDrives ?? []).map((d) => ({ value: d.id, label: `${d.name} (Shared Drive)` })),
                  ]}
                />
              </View>

              {driveStatus.account.rootFolderUrl ? (
                <>
                  <Tap onPress={() => void Linking.openURL(driveStatus.account!.rootFolderUrl!)} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                    <T size={12.5} weight={600} color={colors.accent}>
                      Open Drive folder ↗
                    </T>
                  </Tap>
                  <T size={11} lh={1.375} color={colors.inkFaint} style={{ marginTop: 6 }}>
                    Accountants see this archive view-only in their app. To let them open it, add their Google accounts as{' '}
                    <T size={11} weight={700} color={colors.inkFaint}>
                      Viewer
                    </T>{' '}
                    in Google Drive.
                  </T>
                </>
              ) : (
                <T size={12} lh={16 / 12} color={colors.inkMuted} style={{ marginTop: 10 }}>
                  {"The Drive folder will appear here once it's created."}
                </T>
              )}

              <Tap onPress={() => void disconnectDrive()} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                <T size={12} weight={600} color={colors.warningText}>
                  Disconnect
                </T>
              </Tap>
            </View>
          </View>
        ) : null}

        {driveStatus?.configured && !driveStatus.connected ? (
          <View>
            <T size={13} color={colors.inkMuted} style={{ marginBottom: 10 }}>
              Connect a Google account so accountants can save bill photos straight to Drive, organized by project.
            </T>
            <PrimaryButton onPress={() => void connectDrive()} disabled={connecting} style={{ alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, boxShadow: shadowSoft }}>
              <T size={12.5} weight={700} color={colors.white}>
                {connecting ? 'Connecting…' : 'Connect Google Drive'}
              </T>
            </PrimaryButton>
          </View>
        ) : null}
      </View>

      <View style={styles.tiles}>
        <Tile
          onPress={() => router.navigate('/admin/users')}
          value={(counts?.userCounts.supervisor ?? 0) + (counts?.userCounts.accountant ?? 0)}
          label={`Users (${counts?.userCounts.supervisor ?? 0} supervisor, ${counts?.userCounts.accountant ?? 0} accountant)`}
        />
        <Tile onPress={() => router.navigate('/admin/projects')} value={counts?.projectCount ?? '–'} label="Projects" />
        <Tile onPress={() => router.navigate('/admin/deliveries')} value={counts?.deliveryCount ?? '–'} label="Bills logged" />
        <Tile
          onPress={() => scroll.current?.scrollTo({ y: notificationsY, animated: true })}
          value={counts?.pendingPasswordResets ?? 0}
          label="Password resets pending"
          warn
        />
      </View>

      <View onLayout={(e) => setNotificationsY(e.nativeEvent.layout.y)}>
        <SectionLabel>Notifications</SectionLabel>
      </View>

      {pending.length === 0 ? (
        <T size={14} lh={20 / 14} color={colors.inkMuted}>
          {"No pending requests — you're all caught up."}
        </T>
      ) : null}

      <View style={{ gap: 10 }}>
        {pending.map((req) => {
          const newPassword = passwordFor(req.id)
          return (
            <View key={req.id} style={[glass, styles.request]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <IconAlertTriangle size={16} stroke={colors.warningText} strokeWidth={2.5} />
                <View style={{ flex: 1 }}>
                  <T size={13.5} weight={700}>
                    {req.user.name} forgot their password
                  </T>
                  <T size={12} lh={16 / 12} color={colors.inkMuted} style={{ marginTop: 2 }}>
                    {req.user.phone} · {req.user.role}
                  </T>
                  {req.note ? (
                    <T size={12} lh={16 / 12} color={colors.inkMuted} style={{ marginTop: 4, fontStyle: 'italic', fontFamily: 'IBMPlexSans_400Regular_Italic' }}>
                      {`"${req.note}"`}
                    </T>
                  ) : null}

                  {newPassword ? (
                    <View style={styles.passwordBox}>
                      <T size={11} weight={600} color={colors.successText}>
                        New password — relay this to {req.user.name}:
                      </T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                        <T size={15} weight={700} color={colors.successText} selectable style={{ letterSpacing: 0.375 }}>
                          {newPassword}
                        </T>
                        <Tap onPress={() => setResolved((prev) => prev.filter((r) => r.request.id !== req.id))} style={styles.doneButton}>
                          <T size={12} weight={700} color={colors.successText}>
                            Done
                          </T>
                        </Tap>
                      </View>
                    </View>
                  ) : (
                    <PrimaryButton
                      onPress={() => void resolve(req.id)}
                      disabled={resolving === req.id}
                      style={{ alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, boxShadow: shadowSoft }}
                    >
                      <T size={12.5} weight={700} color={colors.white}>
                        {resolving === req.id ? 'Setting…' : 'Set new password'}
                      </T>
                    </PrimaryButton>
                  )}
                </View>
              </View>
            </View>
          )
        })}
      </View>
    </AdminShell>
  )
}

const styles = StyleSheet.create({
  driveCard: { borderRadius: radii.card, padding: 16, marginBottom: 20 },
  okIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  tile: { width: '48.5%', flexGrow: 1, borderRadius: radii.card, padding: 14 },
  warnTile: {
    backgroundColor: 'rgba(253, 242, 224, 0.85)',
    boxShadow: shadowSoft,
  },
  request: { borderRadius: radii.card, padding: 16 },
  passwordBox: {
    marginTop: 10,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneButton: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
})
