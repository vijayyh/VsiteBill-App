import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconShield } from '../components/icons'
import { DEMO_CREDENTIALS, useSession } from '../lib/session'

export function Login() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('+91 ')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function attemptLogin(phoneValue: string, passwordValue: string) {
    setError(null)
    setBusy(true)
    try {
      const user = await login(phoneValue, passwordValue)
      navigate(`/${user.role}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    attemptLogin(phone, password)
  }

  function handleDemo(role: 'supervisor' | 'accountant') {
    const creds = DEMO_CREDENTIALS[role]
    setPhone(creds.phone)
    attemptLogin(creds.phone, creds.password)
  }

  return (
    <div className="flex-grow flex flex-col justify-center px-7 py-8 text-ink">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-10 h-10 rounded-btn bg-accent flex items-center justify-center flex-shrink-0">
          <IconShield size={20} stroke="#FFFFFF" />
        </div>
        <div>
          <div className="text-[19px] font-bold leading-tight">SiteVerify</div>
          <div className="text-xs text-ink-muted mt-0.5">Delivery verification for KH &amp; Sustaniq</div>
        </div>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4 mb-[22px]">
        <div>
          <label className="text-[12.5px] font-semibold text-label mb-1.5 block" htmlFor="phone">
            Phone number
          </label>
          <input
            id="phone"
            className="w-full rounded-btn border border-border-strong px-3.5 py-3 text-[14.5px] text-ink bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[12.5px] font-semibold text-label mb-1.5 block" htmlFor="pass">
            Password
          </label>
          <input
            id="pass"
            type="password"
            className="w-full rounded-btn border border-border-strong px-3.5 py-3 text-[14.5px] text-ink bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="········"
          />
        </div>

        {error && <div className="text-[12.5px] font-semibold text-warning-text -mt-1">{error}</div>}

        <Link to="/forgot-password" className="self-end text-[12.5px] font-semibold text-accent -mt-2">
          Forgot password?
        </Link>

        <button
          type="submit"
          disabled={busy}
          className="w-full text-center py-4 rounded-btn bg-accent text-white text-[15px] font-bold mt-1.5 disabled:opacity-60"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <div className="flex items-center gap-2.5 my-[22px]">
        <div className="flex-grow h-px bg-border" />
        <div className="text-[11px] text-ink-faint font-semibold">OR VIEW A DEMO ROLE</div>
        <div className="flex-grow h-px bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => handleDemo('supervisor')}
          disabled={busy}
          className="text-center py-3 px-2 rounded-btn border border-border-strong bg-surface text-[12.5px] font-semibold text-ink disabled:opacity-60"
        >
          Site Supervisor
        </button>
        <button
          onClick={() => handleDemo('accountant')}
          disabled={busy}
          className="text-center py-3 px-2 rounded-btn border border-border-strong bg-surface text-[12.5px] font-semibold text-ink disabled:opacity-60"
        >
          Office / Accountant
        </button>
      </div>
    </div>
  )
}
