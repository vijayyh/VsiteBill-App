import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AuthImage } from '../../components/AuthImage'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ScreenHeader } from '../../components/ScreenHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { Card, Field, btnPrimary, btnSecondary } from '../../components/ui'
import { IconAlertTriangle, IconCamera, IconCheck, IconClipboardCheck, IconCloud } from '../../components/icons'
import { api, ApiError, useApiGet } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import type { Delivery, Project } from '../../lib/types'

export function ReviewDelivery() {
  const { projectId = '', deliveryId = '' } = useParams()
  const location = useLocation()
  // Lists that open a bill (Home, Review queue) pass where they are so back/save returns there.
  const backTo = (location.state as { from?: string } | null)?.from ?? `/accountant/projects/${projectId}/gallery`
  const { data: projectData, error: projectError } = useApiGet<{ project: Project }>(
    `/api/projects/${projectId}`,
  )
  const {
    data: deliveryData,
    error: deliveryError,
    refetch: refetchDelivery,
  } = useApiGet<{ delivery: Delivery }>(`/api/deliveries/${deliveryId}`)
  const navigate = useNavigate()

  const [vendor, setVendor] = useState('')
  const [item, setItem] = useState('')
  const [orderedQty, setOrderedQty] = useState('')
  const [quantity, setQuantity] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [savingToDrive, setSavingToDrive] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)

  const delivery = deliveryData?.delivery
  const project = projectData?.project

  useEffect(() => {
    if (!delivery) return
    setVendor(delivery.vendor)
    setItem(delivery.item)
    setOrderedQty(delivery.ordered != null ? String(delivery.ordered) : '')
    setQuantity(delivery.delivered != null ? String(delivery.delivered) : '')
    setPoNumber(delivery.poNumber ?? '')
    setNote(delivery.note ?? '')
  }, [delivery])

  if (projectError || deliveryError) return <Navigate to="/accountant" replace />
  if (!delivery || !project) {
    return (
      <div className="flex flex-col flex-grow text-ink">
        <ScreenHeader backTo={backTo} title="Review bill" />
        <div className="flex-grow flex items-center justify-center text-sm text-ink-muted">Loading…</div>
      </div>
    )
  }

  const ordered = Number(orderedQty) || 0
  const delivered = Number(quantity) || 0
  const diff = ordered - delivered
  const hasDiscrepancy = diff !== 0

  const missingFields: string[] = []
  if (!vendor.trim()) missingFields.push('vendor')
  if (!item.trim()) missingFields.push('item description')
  if (!orderedQty.trim()) missingFields.push('ordered quantity')
  if (!quantity.trim()) missingFields.push('delivered quantity')
  if (!poNumber.trim()) missingFields.push('PO number')

  async function saveToDrive() {
    setSavingToDrive(true)
    setDriveError(null)
    try {
      await api.post(`/api/deliveries/${deliveryId}/save-to-drive`)
      refetchDelivery()
    } catch (err) {
      setDriveError(err instanceof ApiError ? err.message : 'Could not save to Drive')
    } finally {
      setSavingToDrive(false)
    }
  }

  async function save(status: 'MATCHED' | 'REVIEW') {
    if (status === 'MATCHED' && missingFields.length > 0) {
      setShowErrors(true)
      return
    }

    setSaving(true)
    try {
      await api.patch(`/api/deliveries/${deliveryId}`, {
        vendor,
        item,
        ordered: orderedQty === '' ? null : Number(orderedQty),
        delivered: quantity === '' ? null : Number(quantity),
        poNumber,
        note,
        status,
      })
      navigate(backTo)
    } catch {
      setSaving(false)
    }
  }

  // Until the PO's ordered quantity is entered there's nothing to compare against.
  const comparable = orderedQty.trim() !== '' && quantity.trim() !== ''
  const tone = !comparable
    ? { text: 'text-ink-muted', bg: 'bg-white/80', stroke: 'var(--color-ink-muted)' }
    : hasDiscrepancy
      ? { text: 'text-warning-text', bg: 'bg-warning-bg', stroke: 'var(--color-warning-text)' }
      : { text: 'text-success-text', bg: 'bg-success-bg', stroke: 'var(--color-success-text)' }

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ScreenHeader
        backTo={backTo}
        title="Review bill"
        subtitle={`${project.code} · ${project.name}`}
        action={<StatusBadge status={delivery.status} />}
      />

      <div className="flex-grow px-5 pt-2 pb-4 flex flex-col gap-4">
        <Card className="p-1.5">
          <button
            type="button"
            onClick={() => delivery.photoUrl && setViewerOpen(true)}
            aria-label="View bill photo"
            className="relative block w-full aspect-[4/3] rounded-[14px] bg-camera-bg overflow-hidden"
          >
            {delivery.photoUrl ? (
              <AuthImage src={delivery.photoUrl} className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center">
                <IconCamera size={32} stroke="#8D9A9E" />
              </span>
            )}
            {delivery.photoUrl && (
              <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/45 ring-1 ring-white/30 backdrop-blur text-white text-[12px] font-bold px-3 py-1.5">
                Tap to enlarge
              </span>
            )}
          </button>
          <div className="flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-1.5">
            <div className="text-[11.5px] text-ink-muted min-w-0 truncate">
              {delivery.uploadedBy ? `${delivery.uploadedBy} · ` : ''}
              {formatDateTime(delivery.uploadedAt)}
            </div>
            {delivery.photoUrl &&
              (delivery.driveFileId ? (
                <a
                  href={delivery.driveWebViewLink ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-shrink-0 flex items-center gap-1 text-[12px] font-bold text-success-text bg-success-bg rounded-full px-2.5 py-1"
                >
                  <IconCheck size={13} stroke="var(--color-success-text)" strokeWidth={2.5} />
                  In Drive ↗
                </a>
              ) : (
                <button
                  type="button"
                  onClick={saveToDrive}
                  disabled={savingToDrive}
                  className="flex-shrink-0 flex items-center gap-1 text-[12px] font-bold text-accent bg-info-bg rounded-full px-2.5 py-1 disabled:opacity-60"
                >
                  <IconCloud size={13} stroke="var(--color-accent)" />
                  {savingToDrive ? 'Saving…' : 'Save to Drive'}
                </button>
              ))}
          </div>
          {driveError && <div className="text-[12px] font-semibold text-warning-text px-2.5 pb-1.5">{driveError}</div>}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center ${tone.bg}`}>
              {!comparable ? (
                <IconClipboardCheck size={14} stroke={tone.stroke} />
              ) : hasDiscrepancy ? (
                <IconAlertTriangle size={14} stroke={tone.stroke} strokeWidth={2.5} />
              ) : (
                <IconCheck size={14} stroke={tone.stroke} strokeWidth={2.6} />
              )}
            </span>
            <div className={`text-[14px] font-bold ${tone.text}`}>
              {!comparable
                ? 'Enter both quantities to compare'
                : hasDiscrepancy
                  ? 'Quantity mismatch'
                  : 'Quantities match'}
            </div>
          </div>
          <div className="grid grid-cols-3 mt-3.5 rounded-[14px] bg-white/60 ring-1 ring-white divide-x divide-black/[0.06] text-center">
            <div className="py-2.5">
              <div className="text-[11px] text-ink-muted">Ordered</div>
              <div className="text-[20px] font-bold leading-tight mt-0.5">{orderedQty.trim() ? ordered : '—'}</div>
            </div>
            <div className="py-2.5">
              <div className="text-[11px] text-ink-muted">Delivered</div>
              <div className="text-[20px] font-bold leading-tight mt-0.5">{quantity.trim() ? delivered : '—'}</div>
            </div>
            <div className="py-2.5">
              <div className={`text-[11px] ${tone.text}`}>
                {!comparable ? 'Difference' : diff > 0 ? 'Short by' : diff < 0 ? 'Extra' : 'Difference'}
              </div>
              <div className={`text-[20px] font-bold leading-tight mt-0.5 ${tone.text}`}>
                {comparable ? Math.abs(diff) : '—'}
              </div>
            </div>
          </div>
        </Card>

        <div>
          <div className="text-[12px] font-bold text-ink-muted uppercase tracking-wide mb-2.5 ml-1">Bill details</div>
          <div className="flex flex-col gap-3.5">
            <Field
              id="vendor"
              label="Vendor"
              invalid={showErrors && !vendor.trim()}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
            <Field
              id="item"
              label="Item description"
              invalid={showErrors && !item.trim()}
              value={item}
              onChange={(e) => setItem(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="ordered-qty"
                label="Ordered qty"
                inputMode="decimal"
                invalid={showErrors && !orderedQty.trim()}
                value={orderedQty}
                onChange={(e) => setOrderedQty(e.target.value)}
              />
              <Field
                id="qty"
                label={
                  <>
                    Delivered qty
                    {delivery.quantityLowConfidence && (
                      <span className="text-[9px] font-bold text-warning-text bg-warning-bg rounded px-[5px] py-px">
                        DOUBLE-CHECK
                      </span>
                    )}
                  </>
                }
                inputMode="decimal"
                invalid={delivery.quantityLowConfidence || (showErrors && !quantity.trim())}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <Field
              id="po"
              label="PO number"
              invalid={showErrors && !poNumber.trim()}
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
            <div>
              <label className="text-[12px] font-semibold text-label mb-1.5 ml-3 block" htmlFor="note">
                Note (optional)
              </label>
              <textarea
                id="note"
                rows={2}
                placeholder="e.g. Short by 10 bags — vendor to send the remainder"
                className="w-full rounded-[16px] glass-strong px-4 py-3 text-[13.5px] text-ink placeholder:text-ink-faint resize-none outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 px-3 pb-3 pt-2">
        <div className="glass-strong rounded-[24px] p-2.5 flex flex-col gap-2">
          {showErrors && missingFields.length > 0 && (
            <div className="text-[12px] font-semibold text-warning-text text-center pt-1">
              Fill in {missingFields.join(', ')} before confirming a match.
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => save('REVIEW')}
              disabled={saving}
              className={`${btnSecondary} flex-1 py-3.5 text-[13.5px] text-warning-text`}
            >
              <IconAlertTriangle size={15} stroke="var(--color-warning-text)" strokeWidth={2.4} />
              {delivery.status === 'REVIEW' ? 'Keep flagged' : 'Flag'}
            </button>
            <button onClick={() => save('MATCHED')} disabled={saving} className={`${btnPrimary} flex-[1.4] py-3.5 text-[14px]`}>
              <IconCheck size={16} stroke="#FFFFFF" strokeWidth={2.6} />
              {delivery.status === 'MATCHED' ? 'Save as matched' : 'Confirm match'}
            </button>
          </div>
        </div>
      </div>

      {viewerOpen && <PhotoViewer src={delivery.photoUrl} onClose={() => setViewerOpen(false)} />}
    </div>
  )
}
