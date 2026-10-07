import { useRef, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { AdminField, AdminShell } from '../../../components/AdminShell'
import { SelectField } from '../../../components/SelectField'
import { T } from '../../../components/T'
import { PrimaryButton, SecondaryButton, Tap } from '../../../components/ui'
import { api, ApiError, useApiGet } from '../../../lib/api'
import { useSession, type Role } from '../../../lib/session'
import { colors, glass, navyGradient, radii, ring, shadowSoft } from '../../../lib/theme'
import type { AdminUser } from '../../../lib/types'

// Same as the web app's admin Users tab (frontend/src/screens/admin/Users.tsx).
const roleLabel: Record<Role, string> = {
  supervisor: 'Supervisor',
  accountant: 'Accountant',
  admin: 'Admin',
}

/** "Reset password" with a confirm tap, then the new temporary password to relay. */
function ResetPassword({ user }: { user: AdminUser }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function reset() {
    setStep('busy')
    setError(null)
    try {
      const res = await api.post<{ temporaryPassword: string }>(`/api/admin/users/${user.id}/reset-password`)
      setPassword(res.temporaryPassword)
      setStep('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password')
      setStep('idle')
    }
  }

  if (step === 'done') {
    return (
      <View style={styles.newPassword}>
        <T size={11} weight={600} color={colors.successText}>
          New password — relay this to {user.name}:
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
          <T size={15} weight={700} color={colors.successText} selectable style={{ letterSpacing: 0.375 }}>
            {password}
          </T>
          <Tap onPress={() => setStep('idle')} style={styles.done}>
            <T size={12} weight={700} color={colors.successText}>
              Done
            </T>
          </Tap>
        </View>
      </View>
    )
  }

  return (
    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {step === 'idle' ? (
        <Tap onPress={() => setStep('confirm')} style={[styles.chip, { backgroundColor: colors.infoBg }]}>
          <T size={12} weight={700} color={colors.accent}>
            Reset password
          </T>
        </Tap>
      ) : (
        <>
          <T size={12} color={colors.inkMuted}>
            Their current password will stop working.
          </T>
          <Tap onPress={() => setStep('idle')} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <T size={12} weight={600} color={colors.inkMuted}>
              Cancel
            </T>
          </Tap>
          <Tap onPress={() => void reset()} disabled={step === 'busy'} style={[styles.chip, { backgroundColor: colors.accent }, step === 'busy' && { opacity: 0.6 }]}>
            <T size={12} weight={700} color={colors.white}>
              {step === 'busy' ? 'Resetting…' : 'Reset'}
            </T>
          </Tap>
        </>
      )}
      {error ? (
        <T size={12} weight={600} color={colors.warningText}>
          {error}
        </T>
      ) : null}
    </View>
  )
}

export default function AdminUsers() {
  const { user: me } = useSession()
  const { data, refetch, refresh, refreshing } = useApiGet<{ users: AdminUser[] }>('/api/admin/users')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+91 ')
  const [role, setRole] = useState<Role>('supervisor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; phone: string; password: string } | null>(null)
  const nameRef = useRef<TextInput>(null)
  const phoneRef = useRef<TextInput>(null)

  const users = data?.users ?? []

  async function submit() {
    // The web form's `required` fields: an empty one is focused instead of submitting.
    if (!name) return nameRef.current?.focus()
    if (!phone) return phoneRef.current?.focus()
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<{ user: AdminUser; temporaryPassword: string }>('/api/admin/users', { name, phone, role })
      setCreated({ name: res.user.name, phone: res.user.phone, password: res.temporaryPassword })
      setName('')
      setPhone('+91 ')
      setRole('supervisor')
      setShowForm(false)
      refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell title="Users" refreshing={refreshing} onRefresh={refresh}>
      {created ? (
        <View style={styles.created}>
          <T size={13} weight={700} color={colors.successText}>
            {created.name} was created
          </T>
          <T size={12} lh={16 / 12} color={colors.successText} style={{ marginTop: 4 }}>
            Phone: {created.phone}
          </T>
          <T size={12} lh={16 / 12} color={colors.successText}>
            Temporary password:{' '}
            <T size={12} lh={16 / 12} weight={700} color={colors.successText} selectable style={{ letterSpacing: 0.3 }}>
              {created.password}
            </T>
          </T>
          <T size={11} color={colors.successText} style={{ marginTop: 6 }}>
            {"Relay these to them directly — this won't be shown again."}
          </T>
        </View>
      ) : null}

      {!showForm ? (
        <SecondaryButton onPress={() => setShowForm(true)} style={{ paddingVertical: 12, marginBottom: 16 }}>
          <T size={14} lh={20 / 14} weight={600}>
            + Add user
          </T>
        </SecondaryButton>
      ) : (
        <View style={[glass, styles.form]}>
          <AdminField ref={nameRef} label="Name" value={name} onChangeText={setName} />
          <AdminField ref={phoneRef} label="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <SelectField
            label="Role"
            value={role}
            onChange={setRole}
            options={(['supervisor', 'accountant', 'admin'] as const).map((r) => ({ value: r, label: roleLabel[r] }))}
          />
          {error ? (
            <T size={12} weight={600} color={colors.warningText}>
              {error}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SecondaryButton onPress={() => setShowForm(false)} style={{ flexGrow: 1, paddingVertical: 10 }}>
              <T size={13} weight={600}>
                Cancel
              </T>
            </SecondaryButton>
            <PrimaryButton onPress={() => void submit()} disabled={busy} style={{ flexGrow: 1, paddingVertical: 10, boxShadow: shadowSoft }}>
              <T size={13} weight={700} color={colors.white}>
                {busy ? 'Creating…' : 'Create'}
              </T>
            </PrimaryButton>
          </View>
        </View>
      )}

      <View style={{ gap: 10 }}>
        {users.map((u) => (
          <View key={u.id} style={[glass, styles.user]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.avatar}>
                <T size={12} weight={700} color={colors.white}>
                  {u.initials}
                </T>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={13.5} weight={700} numberOfLines={1}>
                  {u.name}
                </T>
                <T size={12} lh={16 / 12} color={colors.inkMuted} style={{ marginTop: 1 }}>
                  {u.phone}
                </T>
                {u.role !== 'admin' ? (
                  <T size={11} color={colors.inkFaint} style={{ marginTop: 1 }}>
                    {u.deliveryCount} bill{u.deliveryCount === 1 ? '' : 's'} across {u.projectsUploadedTo} project
                    {u.projectsUploadedTo === 1 ? '' : 's'}
                  </T>
                ) : null}
              </View>
              <View style={styles.role}>
                <T size={10.5} weight={700} color={colors.inkMuted}>
                  {roleLabel[u.role]}
                </T>
              </View>
            </View>
            {/* Your own password is changed from Profile, which asks for the current one. */}
            {u.id !== me?.id ? <ResetPassword user={u} /> : null}
          </View>
        ))}
      </View>
    </AdminShell>
  )
}

const styles = StyleSheet.create({
  created: {
    backgroundColor: 'rgba(232, 242, 236, 0.9)',
    ...ring(1, colors.successBorder),
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 16,
  },
  form: { borderRadius: radii.card, padding: 16, marginBottom: 16, gap: 12 },
  user: { borderRadius: radii.card, padding: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: navyGradient,
    ...ring(2, 'rgba(255,255,255,0.8)'),
  },
  role: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.75)',
    ...ring(1, colors.white),
  },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  newPassword: {
    marginTop: 10,
    backgroundColor: 'rgba(232, 242, 236, 0.9)',
    ...ring(1, colors.successBorder),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  done: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
})
