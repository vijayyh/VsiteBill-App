import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Field, btnPrimary } from '../../components/ui'
import { IconCamera } from '../../components/icons'
import { api, ApiError } from '../../lib/api'
import { compressImage } from '../../lib/compressImage'
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
  if (!quantity.trim()) missingFields.push('quantity delivered')

  async function handleSubmit() {
    if (missingFields.length > 0) {
      setShowErrors(true)
      return
    }

    setUploading(true)
    setError(null)
    const successPath = `/supervisor/projects/${projectId}/success`
    const details = { vendor, item, delivered: quantity, poNumber }
    const photo = await compressImage(file!)

    if (!navigator.onLine) {
      await queueUpload(projectId, photo, photo.name || 'bill.jpg', details)
      navigate(successPath, { state: { queued: true } })
      return
    }

    try {
      const form = new FormData()
      form.append('photo', photo)
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
      await queueUpload(projectId, photo, photo.name || 'bill.jpg', details)
      navigate(successPath, { state: { queued: true } })
    }
  }

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ScreenHeader backTo={`/supervisor/projects/${projectId}/upload`} title="Bill details" subtitle="Step 2 of 2 · copy from the bill" />

      <div className="flex-grow px-5 pt-2 pb-4 flex flex-col gap-4">
        <div className="glass rounded-card p-1.5">
          <div className="relative w-full aspect-[4/3] rounded-[14px] bg-camera-bg overflow-hidden">
            {previewUrl && <img src={previewUrl} alt="The bill you photographed" className="w-full h-full object-cover" />}
            <Link
              to={`/supervisor/projects/${projectId}/upload`}
              className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/45 ring-1 ring-white/30 backdrop-blur text-white text-[12px] font-bold px-3 py-1.5"
            >
              <IconCamera size={14} stroke="#FFFFFF" />
              Retake
            </Link>
          </div>
        </div>

        <div className="text-[12.5px] text-ink-muted leading-relaxed px-1">
          Copy these from the bill. The office team will check them against the purchase order.
        </div>

        <div className="flex flex-col gap-3.5">
          <Field
            id="vendor"
            label="Vendor"
            placeholder="e.g. UltraTech Cement Ltd"
            invalid={showErrors && !vendor.trim()}
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
          <Field
            id="item"
            label="Item description"
            placeholder="e.g. OPC 53 Grade Cement, 50kg bags"
            invalid={showErrors && !item.trim()}
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="qty"
              label="Quantity delivered"
              inputMode="decimal"
              placeholder="e.g. 480"
              invalid={showErrors && !quantity.trim()}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Field
              id="po"
              label="PO number"
              placeholder="If known"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 px-3 pb-3 pt-2">
        <div className="glass-strong rounded-[24px] p-2.5 flex flex-col gap-2">
          {error && <div className="text-[12.5px] font-semibold text-warning-text text-center pt-1">{error}</div>}
          {showErrors && missingFields.length > 0 && (
            <div className="text-[12.5px] font-semibold text-warning-text text-center pt-1">
              Fill in {missingFields.join(', ')} before sending.
            </div>
          )}
          <button onClick={handleSubmit} disabled={uploading} className={`${btnPrimary} w-full py-4 text-[15px]`}>
            {uploading ? 'Sending…' : 'Send to office'}
          </button>
        </div>
      </div>
    </div>
  )
}
