import { useState } from 'react'
import { IconCheck } from './icons'
import { api, ApiError, useApiGet } from '../lib/api'
import type { PaymentSheetStatus } from '../lib/types'

/**
 * Admin: which Google Sheet bills approved for payment go to. It's written through the Google
 * account connected for Drive, which also needs Sheets access (accounts connected before the
 * payment sheet existed have to reconnect once).
 */
export function PaymentSheetAdmin({ onReconnect, reconnecting }: { onReconnect: () => void; reconnecting: boolean }) {
  const { data: status, refetch } = useApiGet<PaymentSheetStatus>('/api/payment-sheet')
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/payment-sheet', { link })
      setLink('')
      refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    await api.delete('/api/payment-sheet')
    refetch()
  }

  return (
    <>
      <div className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-2.5">Payment sheet</div>
      <div className="glass rounded-card p-4 mb-5">
        {!status && <div className="text-[13px] text-ink-muted">Loading…</div>}

        {status && !status.googleConnected && (
          <div className="text-[13px] text-ink-muted leading-relaxed">
            Connect Google Drive above first: the payment sheet is written through the same Google account.
          </div>
        )}

        {status?.googleConnected && !status.sheetsAllowed && (
          <div>
            <div className="text-[13px] text-ink-muted leading-relaxed mb-2.5">
              To add approved bills to a Google Sheet, {status.googleEmail} needs to allow one more permission
              (Google Sheets). Connect it again and tick the new permission.
            </div>
            <button
              onClick={onReconnect}
              disabled={reconnecting}
              className="text-[12.5px] font-bold text-white bg-accent rounded-full px-4 py-2 shadow-soft disabled:opacity-60"
            >
              {reconnecting ? 'Connecting…' : 'Reconnect Google'}
            </button>
          </div>
        )}

        {status?.googleConnected && status.sheetsAllowed && status.sheet && (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-success-bg flex items-center justify-center flex-shrink-0">
              <IconCheck size={16} stroke="var(--color-success-text)" strokeWidth={2.5} />
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-[13.5px] font-bold truncate">{status.sheet.title}</div>
              <div className="text-xs text-ink-muted mt-0.5">
                Tab “{status.sheet.tabTitle}”{status.sheet.connectedBy ? ` · connected by ${status.sheet.connectedBy}` : ''}
              </div>
              <a
                href={status.sheet.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-block text-[12.5px] font-semibold text-accent"
              >
                Open payment sheet ↗
              </a>
              <div className="text-[11px] text-ink-faint mt-1.5 leading-snug">
                Accountants add matched bills here with “Approve for payment”. The app never writes Status or
                Pay Receipts: those are the payment manager’s.
              </div>
              <button onClick={disconnect} className="mt-2.5 text-[12px] font-semibold text-warning-text">
                Disconnect
              </button>
            </div>
          </div>
        )}

        {status?.googleConnected && status.sheetsAllowed && !status.sheet && (
          <div>
            <div className="text-[13px] text-ink-muted leading-relaxed mb-2.5">
              Paste the link of the payment register. {status.googleEmail} must be able to edit it (share it with
              that account as an Editor).
            </div>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              aria-label="Payment sheet link"
              className="w-full rounded-[14px] glass-strong px-3 py-2.5 text-[12.5px] outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40"
            />
            {error && <div className="text-[12px] font-semibold text-warning-text mt-2">{error}</div>}
            <button
              onClick={connect}
              disabled={saving || !link.trim()}
              className="mt-2.5 text-[12.5px] font-bold text-white bg-accent rounded-full px-4 py-2 shadow-soft disabled:opacity-60"
            >
              {saving ? 'Checking the sheet…' : 'Connect sheet'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
