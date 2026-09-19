import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCheck } from '../components/icons'
import { api } from '../lib/api'

export function ForgotPassword() {
  const [phone, setPhone] = useState('+91 ')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/api/auth/forgot-password', { phone, note })
      setSubmitted(true)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center px-8 text-center text-ink">
        <div className="w-[84px] h-[84px] rounded-full bg-success-bg flex items-center justify-center mb-6">
          <IconCheck size={38} stroke="var(--color-success-text)" strokeWidth={2.5} />
        </div>
        <div className="text-xl font-bold mb-2">Request sent</div>
        <div className="text-[13.5px] text-ink-muted leading-relaxed mb-8">
          If that phone number has an account, an admin will reach out to set a new password for you.
        </div>
        <Link
          to="/login"
          className="w-full text-center py-4 rounded-btn bg-accent text-white text-[15px] font-bold"
        >
          Back to log in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex-grow flex flex-col justify-center px-7 py-8 text-ink">
      <div className="mb-8">
        <div className="text-xl font-bold mb-2">Forgot your password?</div>
        <div className="text-[13.5px] text-ink-muted leading-relaxed">
          Accounts here are set up by an admin, not self-service — enter your phone number and an admin
          will set you a new password.
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
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
          <label className="text-[12.5px] font-semibold text-label mb-1.5 block" htmlFor="note">
            Note (optional)
          </label>
          <textarea
            id="note"
            rows={2}
            placeholder="Anything the admin should know"
            className="w-full rounded-btn border border-border-strong px-3.5 py-3 text-[13.5px] text-ink bg-surface resize-none focus:outline-2 focus:outline-accent focus:outline-offset-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full text-center py-4 rounded-btn bg-accent text-white text-[15px] font-bold mt-1.5 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send request'}
        </button>
        <Link to="/login" className="text-center text-sm font-semibold text-ink-muted py-2">
          Back to log in
        </Link>
      </form>
    </div>
  )
}
