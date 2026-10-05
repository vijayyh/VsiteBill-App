import { useState } from 'react'
import { AdminShell } from '../../components/AdminShell'
import { IconTruck } from '../../components/icons'
import { api, ApiError, useApiGet } from '../../lib/api'
import type { Project, ProjectAccent } from '../../lib/types'

const accentBg: Record<ProjectAccent, string> = {
  accent: 'bg-accent',
  forest: 'bg-forest',
  clay: 'bg-clay',
}

/* outline, not ring: the glass utility's box-shadow would cancel a ring */
const inputClass =
  'w-full rounded-[14px] glass-strong px-3.5 py-2.5 text-[13.5px] outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40'

const accentOptions: { value: ProjectAccent; label: string }[] = [
  { value: 'accent', label: 'Navy' },
  { value: 'forest', label: 'Green' },
  { value: 'clay', label: 'Amber' },
]

function AccentPicker({ value, onChange }: { value: ProjectAccent; onChange: (accent: ProjectAccent) => void }) {
  return (
    <div className="flex gap-2">
      {accentOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold glass ${
            value === opt.value ? 'ring-2 ring-accent' : 'ring-1 ring-white'
          }`}
        >
          <span className={`w-3 h-3 rounded-full ${accentBg[opt.value]}`} />
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** One project row, with an inline form to rename it or change its colour. The code can't change. */
function ProjectRow({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [accent, setAccent] = useState<ProjectAccent>(project.accent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
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
    <div className="glass rounded-card p-3">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-btn flex items-center justify-center flex-shrink-0 ${accentBg[project.accent]}`}>
          <IconTruck size={16} stroke="#FFFFFF" />
        </div>
        <div className="flex-grow min-w-0">
          <div className="text-[13.5px] font-bold truncate">{project.code}</div>
          <div className="text-xs text-ink-muted mt-px truncate">{project.name}</div>
        </div>
        {!editing && (
          <button
            onClick={() => {
              setName(project.name)
              setAccent(project.accent)
              setError(null)
              setEditing(true)
            }}
            className="text-[12px] font-bold text-accent bg-info-bg rounded-full px-3 py-1.5 flex-shrink-0"
          >
            Edit
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-3">
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1 block" htmlFor={`name-${project.id}`}>
              Site / project name
            </label>
            <input
              id={`name-${project.id}`}
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1.5 block">Colour</label>
            <AccentPicker value={accent} onChange={setAccent} />
          </div>
          {error && <div className="text-[12px] font-semibold text-warning-text">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-grow py-2.5 rounded-full glass text-ink text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-grow py-2.5 rounded-full bg-accent text-white text-[13px] font-bold shadow-soft disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function AdminProjects() {
  const { data, refetch } = useApiGet<{ projects: Project[] }>('/api/projects')
  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accent, setAccent] = useState<ProjectAccent>('accent')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const projects = data?.projects ?? []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
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
    <AdminShell title="Projects">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-full glass text-ink text-sm font-semibold mb-4"
        >
          + Add project
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="glass rounded-card p-4 mb-4 flex flex-col gap-3">
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1 block" htmlFor="new-code">
              Project code
            </label>
            <input
              id="new-code"
              required
              placeholder="e.g. KH-PRJ-030"
              className={inputClass}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1 block" htmlFor="new-project-name">
              Site / project name
            </label>
            <input
              id="new-project-name"
              required
              placeholder="e.g. Vasai Bridge Works"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1.5 block">Colour</label>
            <AccentPicker value={accent} onChange={setAccent} />
          </div>

          {error && <div className="text-[12px] font-semibold text-warning-text">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-grow py-2.5 rounded-full glass text-ink text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-grow py-2.5 rounded-full bg-accent text-white text-[13px] font-bold shadow-soft disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2.5">
        {projects.map((project) => (
          <ProjectRow key={project.id} project={project} onSaved={refetch} />
        ))}
      </div>
    </AdminShell>
  )
}
