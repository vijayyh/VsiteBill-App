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

  const fieldClass =
    'w-full rounded-full border border-border bg-surface px-5 py-3.5 text-[14.5px] text-ink shadow-soft focus:outline-2 focus:outline-accent focus:outline-offset-1'

  return (
    <div className="flex-grow flex flex-col justify-center px-6 py-8 text-ink">
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center flex-shrink-0 shadow-soft">
          <IconShield size={20} stroke="#FFFFFF" />
        </div>
        <div>
          <div className="text-[17px] font-bold leading-tight">SiteVerify</div>
          <div className="text-xs text-ink-muted mt-0.5">KH &amp; Sustaniq sites</div>
        </div>
      </div>

      <div className="text-[28px] font-bold leading-tight">Welcome back</div>
      <div className="text-[14px] text-ink-muted mt-1.5 mb-7">Log in with the phone number your admin registered.</div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4 mb-[22px]">
        <div>
          <label className="text-[12.5px] font-semibold text-label mb-1.5 ml-4 block" htmlFor="phone">
            Phone number
          </label>
          <input id="phone" className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="text-[12.5px] font-semibold text-label mb-1.5 ml-4 block" htmlFor="pass">
            Password
          </label>
          <input
            id="pass"
            type="password"
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="········"
          />
        </div>

        {error && <div className="text-[12.5px] font-semibold text-warning-text -mt-1 ml-4">{error}</div>}

        <Link to="/forgot-password" className="self-end text-[12.5px] font-semibold text-accent -mt-2 mr-2">
          Forgot password?
        </Link>

        <button
          type="submit"
          disabled={busy}
          className="w-full text-center py-4 rounded-full bg-accent text-white text-[15px] font-bold mt-1 shadow-soft disabled:opacity-60"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <div className="flex items-center gap-2.5 my-[18px]">
        <div className="flex-grow h-px bg-border-strong" />
        <div className="text-[11px] text-ink-faint font-semibold">OR TRY A DEMO ROLE</div>
        <div className="flex-grow h-px bg-border-strong" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => handleDemo('supervisor')}
          disabled={busy}
          className="text-center py-3 px-2 rounded-full border border-border bg-surface shadow-soft text-[12.5px] font-semibold text-ink disabled:opacity-60"
        >
          Site Supervisor
        </button>
        <button
          onClick={() => handleDemo('accountant')}
          disabled={busy}
          className="text-center py-3 px-2 rounded-full border border-border bg-surface shadow-soft text-[12.5px] font-semibold text-ink disabled:opacity-60"
        >
          Office / Accountant
        </button>
      </div>
    </div>
  )
}
