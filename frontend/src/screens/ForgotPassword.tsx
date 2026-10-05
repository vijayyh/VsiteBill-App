import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Field, btnPrimary } from '../components/ui'
import { IconBack, IconCheck, IconLock } from '../components/icons'
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
      <div className="flex-grow flex flex-col px-6 pt-10 pb-8 text-ink">
        <div className="flex-grow flex flex-col items-center justify-center text-center">
          <div className="w-[104px] h-[104px] rounded-full bg-success-bg ring-[10px] ring-success-bg/50 shadow-soft flex items-center justify-center mb-6">
            <IconCheck size={48} stroke="var(--color-success-text)" strokeWidth={2.6} />
          </div>
          <div className="text-[24px] font-bold leading-tight">Request sent</div>
          <div className="text-[13.5px] text-ink-muted leading-relaxed mt-2 max-w-[300px]">
            If that phone number has an account, an admin will reach out to set a new password for you.
          </div>
        </div>
        <Link to="/login" className={`${btnPrimary} w-full py-4 text-[15px]`}>
          Back to log in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex-grow flex flex-col px-6 pt-6 pb-8 text-ink">
      <Link
        to="/login"
        aria-label="Back to log in"
        className="w-11 h-11 rounded-full glass-strong flex items-center justify-center"
      >
        <IconBack size={20} />
      </Link>

      <div className="flex-grow flex flex-col justify-center py-8">
        <span className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2f5f8a] to-accent flex items-center justify-center shadow-soft ring-4 ring-white/70">
          <IconLock size={24} stroke="#FFFFFF" />
        </span>
        <div className="text-[28px] font-bold leading-tight mt-5">Forgot your password?</div>
        <div className="text-[14px] text-ink-muted leading-relaxed mt-1.5 mb-7">
          Accounts here are set up by an admin. Enter your phone number and an admin will set you a new
          password.
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field id="phone" label="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div>
            <label className="text-[12px] font-semibold text-label mb-1.5 ml-3 block" htmlFor="note">
              Note (optional)
            </label>
            <textarea
              id="note"
              rows={2}
              placeholder="Anything the admin should know"
              className="w-full rounded-[16px] glass-strong px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint resize-none outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-4 text-[15px] mt-1`}>
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </form>

        <Card className="mt-5 px-4 py-3 text-[12px] text-ink-muted leading-relaxed">
          No SMS or email is sent. Once an admin sets a temporary password, log in with it and change it
          from your Profile.
        </Card>
      </div>
    </div>
  )
}
