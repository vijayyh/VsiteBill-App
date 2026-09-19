import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ScreenHeader } from '../../components/ScreenHeader'
import { api, ApiError } from '../../lib/api'
import { queueUpload } from '../../lib/offlineQueue'

export function DeliveryDetails() {
  const { projectId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const file = (location.state as { file?: File } | null)?.file ?? null

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [vendor, setVendor] = useState('')
  const [item, setItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!file) return <Navigate to={`/supervisor/projects/${projectId}/upload`} replace />

  const missingFields: string[] = []
  if (!vendor.trim()) missingFields.push('vendor')
  if (!item.trim()) missingFields.push('item description')
  if (!quantity.trim()) missingFields.push('quantity')

  async function handleSubmit() {
    if (missingFields.length > 0) {
      setShowErrors(true)
      return
    }

    setUploading(true)
    setError(null)
    const successPath = `/supervisor/projects/${projectId}/success`
    const details = { vendor, item, delivered: quantity, poNumber }

    if (!navigator.onLine) {
      await queueUpload(projectId, file!, file!.name || 'challan.jpg', details)
      navigate(successPath, { state: { queued: true } })
      return
    }

    try {
      const form = new FormData()
      form.append('photo', file!)
      form.append('vendor', vendor)
      form.append('item', item)
      form.append('delivered', quantity)
      form.append('poNumber', poNumber)
      await api.post(`/api/projects/${projectId}/deliveries`, form)
      navigate(successPath)
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Could not upload that photo. Try again.')
        setUploading(false)
        return
      }
      await queueUpload(projectId, file!, file!.name || 'challan.jpg', details)
      navigate(successPath, { state: { queued: true } })
    }
  }

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ScreenHeader backTo={`/supervisor/projects/${projectId}/upload`} title="Delivery details" />

      <div className="flex-grow overflow-y-auto px-4 py-3.5 flex flex-col gap-3.5">
        <div className="w-full aspect-[4/3] rounded-card bg-camera-bg overflow-hidden">
          {previewUrl && <img src={previewUrl} alt="Captured challan" className="w-full h-full object-cover" />}
        </div>

        <div className="text-[12.5px] text-ink-muted leading-relaxed">
          Fill in what's on the bill — the office team will verify it against the purchase order.
        </div>

        {error && <div className="text-[12.5px] font-semibold text-warning-text">{error}</div>}
        {showErrors && missingFields.length > 0 && (
          <div className="text-[12.5px] font-semibold text-warning-text">
            Fill in {missingFields.join(', ')} before submitting.
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12.5px] font-semibold text-label mb-1.5 block" htmlFor="vendor">
              Vendor
            </label>
            <input
              id="vendor"
              placeholder="e.g. UltraTech Cement Ltd"
              className={`w-full rounded-btn border px-3.5 py-3 text-[14.5px] text-ink bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1 ${
                showErrors && !vendor.trim() ? 'border-warning-text' : 'border-border-strong'
              }`}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-label mb-1.5 block" htmlFor="item">
              Item description
            </label>
            <input
              id="item"
              placeholder="e.g. OPC 53 Grade Cement, 50kg bags"
              className={`w-full rounded-btn border px-3.5 py-3 text-[14.5px] text-ink bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1 ${
                showErrors && !item.trim() ? 'border-warning-text' : 'border-border-strong'
              }`}
              value={item}
              onChange={(e) => setItem(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[12.5px] font-semibold text-label mb-1.5 block" htmlFor="qty">
                Quantity
              </label>
              <input
                id="qty"
                inputMode="decimal"
                placeholder="e.g. 480"
                className={`w-full rounded-btn border px-3.5 py-3 text-[14.5px] text-ink bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1 ${
                  showErrors && !quantity.trim() ? 'border-warning-text' : 'border-border-strong'
                }`}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12.5px] font-semibold text-label mb-1.5 block" htmlFor="po">
                PO number (if known)
              </label>
              <input
                id="po"
                placeholder="Optional"
                className="w-full rounded-btn border border-border-strong px-3.5 py-3 text-[14.5px] text-ink bg-surface focus:outline-2 focus:outline-accent focus:outline-offset-1"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 pt-3.5 pb-[30px]">
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full text-center py-4 rounded-btn bg-accent text-white text-[15px] font-bold disabled:opacity-60"
        >
          {uploading ? 'Submitting…' : 'Submit delivery'}
        </button>
      </div>
    </div>
  )
}
