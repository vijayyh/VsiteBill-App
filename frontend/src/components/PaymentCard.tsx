import { useEffect, useRef, useState } from 'react'
import { NumberInput, SectionLabel } from './BillParts'
import { IconCheck } from './icons'
import { btnPrimary, btnSecondary } from './ui'
import { api, ApiError, useApiGet } from '../lib/api'
import { formatMoney, toNumber } from '../lib/bill'
import { formatDateTime } from '../lib/format'
import type { Delivery, PaymentSheetStatus } from '../lib/types'

const box =
  'w-full rounded-[12px] glass-strong px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40'

/**
 * The review screen's Payment tab. Approving a matched bill for payment makes it a row in the
 * payment sheet the payment manager pays from. Once approved, the card shows its Pay ID and what's
 * payable; the sheet row is never written again by the app.
 */
export function PaymentCard({
  delivery,
  onApproved,
  onCancel,
}: {
  delivery: Delivery
  onApproved: () => void
  /** Leaves the form (back to the bill). */
  onCancel: () => void
}) {
  const { data: status } = useApiGet<PaymentSheetStatus>('/api/payment-sheet')
  const [category, setCategory] = useState('')
  const [bankDetails, setBankDetails] = useState('')
  const [hold, setHold] = useState('')
  const [advance, setAdvance] = useState('')
  const [tds, setTds] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  // Set at once (state only after a redraw), so a quick second tap can't send the bill twice.
  const sending = useRef(false)

  const payment = delivery.payment
  const approvable = !payment && delivery.status === 'MATCHED'

  // The vendor's bank details as last entered fill in the form.
  useEffect(() => {
    if (!approvable) return
    let current = true
    api
      .get<{ bankDetails: string }>(`/api/deliveries/${delivery.id}/payment`)
      .then((defaults) => current && setBankDetails((typed) => typed || defaults.bankDetails))
      .catch(() => {
        // Without the remembered details the form still works: they're typed in.
      })
    return () => {
      current = false
    }
  }, [approvable, delivery.id])

  const sheetLink = status?.sheet && (
    <a href={status.sheet.url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-accent">
      Open payment sheet ↗
    </a>
  )

  if (!payment && !approvable) {
    return (
      <div>
        <SectionLabel title="Payment" />
        <div className="glass rounded-[18px] p-4 text-[12.5px] text-ink-muted leading-relaxed">
          Only a matched bill is approved for payment. Check it on the Bill tab and confirm the match, then
          approve it here.
        </div>
      </div>
    )
  }

  if (payment) {
    const held = payment.amountOnHold + payment.advance + payment.tds
    return (
      <div>
        <SectionLabel title="Payment" right={sheetLink} />
        <div className="glass rounded-[18px] p-4 flex gap-3">
          <span className="w-8 h-8 rounded-full bg-success-bg flex items-center justify-center flex-shrink-0">
            <IconCheck size={16} stroke="var(--color-success-text)" strokeWidth={2.6} />
          </span>
          <div className="min-w-0 flex-grow">
            <div className="text-[14px] font-bold text-success-text">Approved for payment</div>
            <div className="text-[12.5px] mt-0.5">
              <span className="font-bold">{payment.payId}</span>
              {payment.sheetRow ? ` · row ${payment.sheetRow} in the sheet` : ''} · {payment.category}
            </div>
            <div className="text-[12.5px] mt-1.5">
              Payable <span className="font-bold">{formatMoney(payment.payable)}</span>
              {held > 0 && (
                <span className="text-ink-muted">
                  {' '}
                  (bill {formatMoney(payment.billAmount)} − held {formatMoney(held)})
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-ink-muted mt-1">
              {payment.approvedBy ? `${payment.approvedBy} · ` : ''}
              {formatDateTime(payment.approvedAt)}
            </div>
            <div className="text-[11px] text-ink-faint mt-2 leading-snug">
              The payment manager marks it PAID and adds the slip in the sheet. Changes to this bill from
              now on don't change its row there.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const total = delivery.totalAmount
  const blocker = !status
    ? null
    : !status.googleConnected || !status.sheet
      ? "The payment sheet isn't connected yet. An admin connects it under Admin → Payment sheet."
      : !status.sheetsAllowed
        ? 'Google needs connecting again to allow the payment sheet (Admin → Google Drive → Reconnect).'
        : total == null
          ? 'Enter the bill’s total amount under Amounts and save, then approve it for payment.'
          : null

  const held = (toNumber(hold) ?? 0) + (toNumber(advance) ?? 0) + (toNumber(tds) ?? 0)
  const payable = total == null ? null : Math.round((total - held) * 100) / 100

  async function approve() {
    if (!category) {
      setShowErrors(true)
      return
    }
    if (sending.current) return
    sending.current = true
    setSaving(true)
    setError(null)
    try {
      await api.post(`/api/deliveries/${delivery.id}/payment`, {
        category,
        bankDetails,
        amountOnHold: hold,
        advance,
        tds,
      })
      onApproved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.')
    } finally {
      sending.current = false
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionLabel title="Approve for payment" right={sheetLink} />
      <div className="glass rounded-[18px] p-4">
        {!status && <div className="text-[12.5px] text-ink-muted">Loading…</div>}
        {blocker && <div className="text-[12.5px] text-ink-muted leading-relaxed">{blocker}</div>}

        {status && !blocker && total != null && (
          <div className="flex flex-col gap-3.5">
            <div className="text-[12.5px] text-ink-muted leading-relaxed">
              Approving adds this bill to the payment sheet for the payment manager.
            </div>
            <div>
              <div className="text-[11px] font-semibold text-label mb-1.5 ml-1">Category</div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
                {status.categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={category === c}
                    onClick={() => setCategory(c)}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                      category === c ? 'bg-accent text-white' : 'glass-strong text-ink'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {showErrors && !category && (
                <div className="text-[11px] font-semibold text-warning-text mt-1 ml-1">Pick a category</div>
              )}
            </div>

            <div>
              <label htmlFor="bank-details" className="block text-[11px] font-semibold text-label mb-1 ml-1">
                Bank details <span className="font-normal text-ink-faint">(remembered for this vendor)</span>
              </label>
              <textarea
                id="bank-details"
                rows={2}
                placeholder="Account no., IFSC, account name"
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                className={`${box} resize-none field-sizing-content max-h-[120px] leading-snug`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'hold', label: 'On hold (₹)', value: hold, set: setHold },
                { id: 'advance', label: 'Advance (₹)', value: advance, set: setAdvance },
                { id: 'tds', label: 'TDS (₹)', value: tds, set: setTds },
              ].map((f) => (
                <div key={f.id} className="min-w-0">
                  <label htmlFor={`pay-${f.id}`} className="block text-[11px] font-semibold text-label mb-1 ml-1">
                    {f.label}
                  </label>
                  <NumberInput id={`pay-${f.id}`} placeholder="0" value={f.value} onChange={f.set} className={box} />
                </div>
              ))}
            </div>

            <div className="rounded-[14px] bg-white/60 ring-1 ring-white px-3 py-2.5 text-[12.5px] flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-ink-muted">Bill amount</span>
                <span>{formatMoney(total)}</span>
              </div>
              {held > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Held back</span>
                  <span>− {formatMoney(held)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-black/[0.06] pt-1 mt-0.5">
                <span>Payable</span>
                <span className={payable != null && payable < 0 ? 'text-warning-text' : ''}>
                  {payable != null ? formatMoney(payable) : '—'}
                </span>
              </div>
            </div>

            {error && <div className="text-[12px] font-semibold text-warning-text">{error}</div>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className={`${btnSecondary} flex-1 py-3 text-[13.5px]`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={approve}
                disabled={saving}
                className={`${btnPrimary} flex-[1.6] py-3 text-[13.5px]`}
              >
                {saving ? 'Adding…' : 'Add to payment sheet'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
