import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AuthImage } from '../../components/AuthImage'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ScreenHeader } from '../../components/ScreenHeader'
import { IconAlertTriangle, IconCamera, IconCheck } from '../../components/icons'
import { api, useApiGet } from '../../lib/api'
import type { Delivery, Project } from '../../lib/types'

export function ReviewDelivery() {
  const { projectId = '', deliveryId = '' } = useParams()
  const { data: projectData, error: projectError } = useApiGet<{ project: Project }>(
    `/api/projects/${projectId}`,
  )
  const { data: deliveryData, error: deliveryError } = useApiGet<{ delivery: Delivery }>(
    `/api/deliveries/${deliveryId}`,
  )
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
        <ScreenHeader backTo={`/accountant/projects/${projectId}/gallery`} title="Review Delivery" />
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
      navigate(`/accountant/projects/${projectId}/gallery`)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ScreenHeader backTo={`/accountant/projects/${project.id}/gallery`} title="Review Delivery" />

      <div className="flex-grow overflow-y-auto px-4 py-3.5 flex flex-col gap-3.5">
        <div className="flex gap-2.5">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => delivery.photoUrl && setViewerOpen(true)}
              className="w-[84px] h-[84px] rounded-btn bg-camera-bg flex-shrink-0 flex items-center justify-center overflow-hidden"
            >
              {delivery.photoUrl ? (
                <AuthImage src={delivery.photoUrl} className="w-full h-full object-cover" />
              ) : (
                <IconCamera size={28} stroke="#8D9A9E" />
              )}
            </button>
            {delivery.photoUrl && (
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="text-[10.5px] font-semibold text-accent"
              >
                View bill photo
              </button>
            )}
          </div>
          <div className="flex-grow flex flex-col justify-center gap-1">
            <div className="flex items-center gap-2">
              {hasDiscrepancy ? (
                <>
                  <IconAlertTriangle size={14} stroke="var(--color-warning-text)" strokeWidth={2.5} />
                  <div className="text-[13px] font-bold text-warning-text">Shortfall flagged</div>
                </>
              ) : (
                <>
                  <IconCheck size={14} stroke="var(--color-success-text)" strokeWidth={2.5} />
                  <div className="text-[13px] font-bold text-success-text">Quantities matched</div>
                </>
              )}
            </div>
            {delivery.uploadedBy && (
              <div className="text-[11.5px] text-ink-muted">
                Uploaded by {delivery.uploadedBy}, {new Date(delivery.uploadedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
            <div className="text-[11.5px] text-ink-muted">{project.code}</div>
          </div>
        </div>

        <div>
          <div className="text-[11.5px] font-bold text-ink-muted uppercase tracking-wide mb-2">
            Extracted from challan
          </div>
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="text-[11.5px] font-semibold text-label mb-[5px] block" htmlFor="vendor">
                Vendor
              </label>
              <input
                id="vendor"
                className={`w-full rounded-field border px-[11px] py-2.5 text-[13px] bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1 ${
                  showErrors && !vendor.trim() ? 'border-warning-text' : 'border-border-strong'
                }`}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11.5px] font-semibold text-label mb-[5px] block" htmlFor="item">
                Item description
              </label>
              <input
                id="item"
                className={`w-full rounded-field border px-[11px] py-2.5 text-[13px] bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1 ${
                  showErrors && !item.trim() ? 'border-warning-text' : 'border-border-strong'
                }`}
                value={item}
                onChange={(e) => setItem(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11.5px] font-semibold text-label mb-[5px] block" htmlFor="ordered-qty">
                  Ordered qty
                </label>
                <input
                  id="ordered-qty"
                  inputMode="decimal"
                  className={`w-full rounded-field border px-[11px] py-2.5 text-[13px] bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1 ${
                    showErrors && !orderedQty.trim() ? 'border-warning-text' : 'border-border-strong'
                  }`}
                  value={orderedQty}
                  onChange={(e) => setOrderedQty(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-[5px]">
                  <label className="text-[11.5px] font-semibold text-label" htmlFor="qty">
                    Delivered qty
                  </label>
                  {delivery.quantityLowConfidence && (
                    <span className="text-[9px] font-bold text-warning-text bg-warning-bg rounded px-[5px] py-px">
                      CHECK
                    </span>
                  )}
                </div>
                <input
                  id="qty"
                  inputMode="decimal"
                  className={`w-full rounded-field border px-[11px] py-2.5 text-[13px] bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1 ${
                    delivery.quantityLowConfidence || (showErrors && !quantity.trim())
                      ? 'border-warning-text'
                      : 'border-border-strong'
                  }`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-[11.5px] font-semibold text-label mb-[5px] block" htmlFor="po">
                PO number
              </label>
              <input
                id="po"
                className={`w-full rounded-field border px-[11px] py-2.5 text-[13px] bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1 ${
                  showErrors && !poNumber.trim() ? 'border-warning-text' : 'border-border-strong'
                }`}
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-3.5">
          <div className="text-[11.5px] font-bold text-ink-muted uppercase tracking-wide mb-2.5">
            Ordered vs delivered
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-ink-muted mb-1">Ordered</div>
              <div className="text-[19px] font-bold">{ordered}</div>
            </div>
            <div>
              <div className="text-[11px] text-ink-muted mb-1">Delivered</div>
              <div className="text-[19px] font-bold">{delivered}</div>
            </div>
            <div>
              <div className={`text-[11px] mb-1 ${hasDiscrepancy ? 'text-warning-text' : 'text-success-text'}`}>
                {diff > 0 ? 'Short by' : diff < 0 ? 'Over by' : 'Match'}
              </div>
              <div className={`text-[19px] font-bold ${hasDiscrepancy ? 'text-warning-text' : 'text-success-text'}`}>
                {Math.abs(diff)}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11.5px] font-semibold text-label mb-[5px] block" htmlFor="note">
            Note (optional)
          </label>
          <textarea
            id="note"
            rows={2}
            placeholder="e.g. call vendor to confirm remainder"
            className="w-full rounded-field border border-border-strong px-[11px] py-2.5 text-xs bg-surface resize-none focus:outline-2 focus:outline-accent focus:outline-offset-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pt-3 pb-[22px] bg-surface border-t border-border flex flex-col gap-2.5">
        {showErrors && missingFields.length > 0 && (
          <div className="text-[12px] font-semibold text-warning-text text-center">
            Fill in {missingFields.join(', ')} before confirming a match.
          </div>
        )}
        <div className="flex gap-2.5">
          <button
            onClick={() => save('REVIEW')}
            disabled={saving}
            className="flex-grow py-3 rounded-btn border border-border-strong text-ink text-[13.5px] font-semibold disabled:opacity-60"
          >
            Flag for follow-up
          </button>
          <button
            onClick={() => save('MATCHED')}
            disabled={saving}
            className="flex-grow py-3 rounded-btn bg-accent text-white text-[13.5px] font-bold disabled:opacity-60"
          >
            Confirm match
          </button>
        </div>
      </div>

      {viewerOpen && (
        <PhotoViewer src={delivery.photoUrl} onClose={() => setViewerOpen(false)} />
      )}
    </div>
  )
}
