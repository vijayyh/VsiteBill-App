import { useEffect, useRef, useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { api, ApiError, useApiGet } from '../lib/api'
import { formatMoney, toNumber } from '../lib/bill'
import { formatDateTime } from '../lib/format'
import { colors, glass, glassStrong, radii, ring } from '../lib/theme'
import type { Delivery, PaymentSheetStatus } from '../lib/types'
import { NumberField, SectionLabel } from './BillParts'
import { IconCheck } from './icons'
import { T } from './T'
import { Field, PrimaryButton, SecondaryButton, Tap } from './ui'

// Same as the web app's payment card (frontend/src/components/PaymentCard.tsx), the review screen's
// Payment tab: approving a matched bill for payment adds it as a row to the payment sheet the payment
// manager pays from.

function SmallLabel({ children }: { children: string }) {
  return (
    <T size={11} weight={600} color={colors.label}>
      {children}
    </T>
  )
}

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
  const status = useApiGet<PaymentSheetStatus>('/api/payment-sheet').data
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

  const sheetUrl = status?.sheet?.url
  const sheetLink = sheetUrl ? (
    <Tap onPress={() => void Linking.openURL(sheetUrl)} hitSlop={6}>
      <T size={12} weight={600} color={colors.accent}>
        Open payment sheet ↗
      </T>
    </Tap>
  ) : undefined

  if (!payment && !approvable) {
    return (
      <View>
        <SectionLabel title="Payment" />
        <View style={[glass, styles.card]}>
          <T size={12.5} lh={1.625} color={colors.inkMuted}>
            Only a matched bill is approved for payment. Check it on the Bill tab and confirm the match, then approve it
            here.
          </T>
        </View>
      </View>
    )
  }

  if (payment) {
    const held = payment.amountOnHold + payment.advance + payment.tds
    return (
      <View>
        <SectionLabel title="Payment" right={sheetLink} />
        <View style={[glass, styles.card, { flexDirection: 'row', gap: 12 }]}>
          <View style={styles.okIcon}>
            <IconCheck size={16} stroke={colors.successText} strokeWidth={2.6} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={14} weight={700} color={colors.successText}>
              Approved for payment
            </T>
            <T size={12.5} style={{ marginTop: 2 }}>
              <T size={12.5} weight={700}>
                {payment.payId}
              </T>
              {payment.sheetRow ? ` · row ${payment.sheetRow} in the sheet` : ''} · {payment.category}
            </T>
            <T size={12.5} style={{ marginTop: 6 }}>
              Payable{' '}
              <T size={12.5} weight={700}>
                {formatMoney(payment.payable)}
              </T>
              {held > 0 ? (
                <T size={12.5} color={colors.inkMuted}>
                  {` (bill ${formatMoney(payment.billAmount)} − held ${formatMoney(held)})`}
                </T>
              ) : null}
            </T>
            <T size={11.5} color={colors.inkMuted} style={{ marginTop: 4 }}>
              {payment.approvedBy ? `${payment.approvedBy} · ` : ''}
              {formatDateTime(payment.approvedAt)}
            </T>
            <T size={11} lh={1.375} color={colors.inkFaint} style={{ marginTop: 8 }}>
              {"The payment manager marks it PAID and adds the slip in the sheet. Changes to this bill from now on don't change its row there."}
            </T>
          </View>
        </View>
      </View>
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
      await api.post(`/api/deliveries/${delivery.id}/payment`, { category, bankDetails, amountOnHold: hold, advance, tds })
      onApproved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.')
    } finally {
      sending.current = false
      setSaving(false)
    }
  }

  return (
    <View>
      <SectionLabel title="Approve for payment" right={sheetLink} />
      <View style={[glass, styles.card]}>
        {!status ? (
          <T size={12.5} color={colors.inkMuted}>
            Loading…
          </T>
        ) : null}
        {blocker ? (
          <T size={12.5} lh={1.625} color={colors.inkMuted}>
            {blocker}
          </T>
        ) : null}

        {status && !blocker && total != null ? (
          <View style={{ gap: 14 }}>
            <T size={12.5} lh={1.625} color={colors.inkMuted}>
              Approving adds this bill to the payment sheet for the payment manager.
            </T>
            <View>
              <View style={{ marginBottom: 6, marginLeft: 4 }}>
                <SmallLabel>Category</SmallLabel>
              </View>
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Category">
                {status.categories.map((c) => {
                  const active = category === c
                  return (
                    <Tap
                      key={c}
                      onPress={() => setCategory(c)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      style={[styles.chip, active ? { backgroundColor: colors.accent } : glassStrong]}
                    >
                      <T size={12.5} weight={600} color={active ? colors.white : colors.ink}>
                        {c}
                      </T>
                    </Tap>
                  )
                })}
              </View>
              {showErrors && !category ? (
                <T size={11} weight={600} color={colors.warningText} style={{ marginTop: 4, marginLeft: 4 }}>
                  Pick a category
                </T>
              ) : null}
            </View>

            <Field
              label={
                <T size={11} weight={600} color={colors.label}>
                  Bank details{' '}
                  <T size={11} color={colors.inkFaint}>
                    (remembered for this vendor)
                  </T>
                </T>
              }
              multiline
              placeholder="Account no., IFSC, account name"
              value={bankDetails}
              onChangeText={setBankDetails}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <NumberField style={{ flex: 1 }} label={<SmallLabel>On hold (₹)</SmallLabel>} placeholder="0" value={hold} onChange={setHold} />
              <NumberField style={{ flex: 1 }} label={<SmallLabel>Advance (₹)</SmallLabel>} placeholder="0" value={advance} onChange={setAdvance} />
              <NumberField style={{ flex: 1 }} label={<SmallLabel>TDS (₹)</SmallLabel>} placeholder="0" value={tds} onChange={setTds} />
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <T size={12.5} color={colors.inkMuted}>
                  Bill amount
                </T>
                <T size={12.5}>{formatMoney(total)}</T>
              </View>
              {held > 0 ? (
                <View style={styles.summaryRow}>
                  <T size={12.5} color={colors.inkMuted}>
                    Held back
                  </T>
                  <T size={12.5}>− {formatMoney(held)}</T>
                </View>
              ) : null}
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <T size={12.5} weight={700}>
                  Payable
                </T>
                <T size={12.5} weight={700} color={payable != null && payable < 0 ? colors.warningText : colors.ink}>
                  {payable != null ? formatMoney(payable) : '—'}
                </T>
              </View>
            </View>

            {error ? (
              <T size={12} weight={600} color={colors.warningText}>
                {error}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SecondaryButton onPress={onCancel} disabled={saving} style={{ flex: 1, paddingVertical: 12 }}>
                <T size={13.5} weight={600}>
                  Cancel
                </T>
              </SecondaryButton>
              <PrimaryButton onPress={() => void approve()} disabled={saving} style={{ flex: 1.6, paddingVertical: 12 }}>
                <T size={13.5} weight={700} color={colors.white}>
                  {saving ? 'Adding…' : 'Add to payment sheet'}
                </T>
              </PrimaryButton>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16 },
  okIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 6 },
  summary: { borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.6)', ...ring(1, colors.white), paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryTotal: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 4, marginTop: 2 },
})
