import { useRef, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { AdminField, AdminShell } from '../../../components/AdminShell'
import { IconTruck } from '../../../components/icons'
import { T } from '../../../components/T'
import { PrimaryButton, SecondaryButton, Tap } from '../../../components/ui'
import { api, ApiError, useApiGet } from '../../../lib/api'
import { ACCENT_COLOR } from '../../../lib/projectColors'
import { colors, glass, radii, shadowSoft } from '../../../lib/theme'
import type { Project, ProjectAccent } from '../../../lib/types'

// Same as the web app's admin Projects tab (frontend/src/screens/admin/Projects.tsx).
const accentOptions: { value: ProjectAccent; label: string }[] = [
  { value: 'accent', label: 'Navy' },
  { value: 'forest', label: 'Green' },
  { value: 'clay', label: 'Amber' },
]

function AccentPicker({ value, onChange }: { value: ProjectAccent; onChange: (accent: ProjectAccent) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {accentOptions.map((opt) => (
        <Tap
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[glass, styles.swatch]}
        >
          <View style={[styles.swatchDot, { backgroundColor: ACCENT_COLOR[opt.value] }]} />
          <T size={12} lh={16 / 12} weight={600}>
            {opt.label}
          </T>
        </Tap>
      ))}
    </View>
  )
}

/** One project row, with an inline form to rename it or change its colour. The code can't change. */
function ProjectRow({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [accent, setAccent] = useState<ProjectAccent>(project.accent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) {
      setError('The project name can’t be empty')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.patch(`/api/admin/projects/${project.id}`, { name, accent })
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the project')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[glass, styles.row]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.rowIcon, { backgroundColor: ACCENT_COLOR[project.accent] }]}>
          <IconTruck size={16} stroke={colors.white} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={13.5} weight={700} numberOfLines={1}>
            {project.code}
          </T>
          <T size={12} lh={16 / 12} color={colors.inkMuted} numberOfLines={1} style={{ marginTop: 1 }}>
            {project.name}
          </T>
        </View>
        {!editing ? (
          <Tap
            onPress={() => {
              setName(project.name)
              setAccent(project.accent)
              setError(null)
              setEditing(true)
            }}
            style={styles.edit}
          >
            <T size={12} weight={700} color={colors.accent}>
              Edit
            </T>
          </Tap>
        ) : null}
      </View>

      {editing ? (
        <View style={{ marginTop: 12, gap: 12 }}>
          <AdminField label="Site / project name" value={name} onChangeText={setName} />
          <View>
            <T size={11.5} weight={600} color={colors.label} style={{ marginBottom: 6 }}>
              Colour
            </T>
            <AccentPicker value={accent} onChange={setAccent} />
          </View>
          {error ? (
            <T size={12} weight={600} color={colors.warningText}>
              {error}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SecondaryButton onPress={() => setEditing(false)} style={{ flexGrow: 1, paddingVertical: 10 }}>
              <T size={13} weight={600}>
                Cancel
              </T>
            </SecondaryButton>
            <PrimaryButton onPress={() => void save()} disabled={busy} style={{ flexGrow: 1, paddingVertical: 10, boxShadow: shadowSoft }}>
              <T size={13} weight={700} color={colors.white}>
                {busy ? 'Saving…' : 'Save'}
              </T>
            </PrimaryButton>
          </View>
        </View>
      ) : null}
    </View>
  )
}

export default function AdminProjects() {
  const { data, refetch, refresh, refreshing } = useApiGet<{ projects: Project[] }>('/api/projects')
  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accent, setAccent] = useState<ProjectAccent>('accent')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeRef = useRef<TextInput>(null)
  const nameRef = useRef<TextInput>(null)

  async function submit() {
    // The web form's `required` fields: an empty one is focused instead of submitting.
    if (!code) return codeRef.current?.focus()
    if (!name) return nameRef.current?.focus()
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/admin/projects', { code, name, accent })
      setCode('')
      setName('')
      setAccent('accent')
      setShowForm(false)
      refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that project')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminShell title="Projects" refreshing={refreshing} onRefresh={refresh}>
      {!showForm ? (
        <SecondaryButton onPress={() => setShowForm(true)} style={{ paddingVertical: 12, marginBottom: 16 }}>
          <T size={14} lh={20 / 14} weight={600}>
            + Add project
          </T>
        </SecondaryButton>
      ) : (
        <View style={[glass, styles.form]}>
          <AdminField ref={codeRef} label="Project code" placeholder="e.g. KH-PRJ-030" autoCapitalize="characters" value={code} onChangeText={setCode} />
          <AdminField ref={nameRef} label="Site / project name" placeholder="e.g. Vasai Bridge Works" value={name} onChangeText={setName} />
          <View>
            <T size={11.5} weight={600} color={colors.label} style={{ marginBottom: 6 }}>
              Colour
            </T>
            <AccentPicker value={accent} onChange={setAccent} />
          </View>
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
        {(data?.projects ?? []).map((project) => (
          <ProjectRow key={`${project.id}-${project.name}-${project.accent}`} project={project} onSaved={refetch} />
        ))}
      </View>
    </AdminShell>
  )
}

const styles = StyleSheet.create({
  form: { borderRadius: radii.card, padding: 16, marginBottom: 16, gap: 12 },
  row: { borderRadius: radii.card, padding: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  edit: { borderRadius: 999, backgroundColor: colors.infoBg, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 0 },
  swatch: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  swatchDot: { width: 12, height: 12, borderRadius: 6 },
})
