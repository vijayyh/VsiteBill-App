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

const accentOptions: { value: ProjectAccent; label: string }[] = [
  { value: 'accent', label: 'Navy' },
  { value: 'forest', label: 'Green' },
  { value: 'clay', label: 'Amber' },
]

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
          className="w-full text-center py-3 rounded-btn border border-border-strong text-ink text-sm font-semibold mb-4"
        >
          + Add project
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-surface border border-border rounded-card p-3.5 mb-4 flex flex-col gap-3">
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1 block" htmlFor="new-code">
              Project code
            </label>
            <input
              id="new-code"
              required
              placeholder="e.g. KH-PRJ-030"
              className="w-full rounded-field border border-border-strong px-3 py-2.5 text-[13.5px] bg-surface"
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
              className="w-full rounded-field border border-border-strong px-3 py-2.5 text-[13.5px] bg-surface"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-label mb-1.5 block">Colour</label>
            <div className="flex gap-2">
              {accentOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAccent(opt.value)}
                  className={`flex items-center gap-1.5 rounded-btn border px-3 py-2 text-xs font-semibold ${
                    accent === opt.value ? 'border-accent' : 'border-border-strong'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${accentBg[opt.value]}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-[12px] font-semibold text-warning-text">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-grow py-2.5 rounded-btn border border-border-strong text-ink text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-grow py-2.5 rounded-btn bg-accent text-white text-[13px] font-bold disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2.5">
        {projects.map((project) => (
          <div key={project.id} className="flex items-center gap-3 bg-surface border border-border rounded-card p-3">
            <div className={`w-10 h-10 rounded-btn flex items-center justify-center flex-shrink-0 ${accentBg[project.accent]}`}>
              <IconTruck size={16} stroke="#FFFFFF" />
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-[13.5px] font-bold truncate">{project.code}</div>
              <div className="text-xs text-ink-muted mt-px truncate">{project.name}</div>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
