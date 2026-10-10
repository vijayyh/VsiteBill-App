import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AmountsCard, ItemsEditor, MarkedLabel, SectionLabel } from '../../components/BillParts'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Field, btnPrimary } from '../../components/ui'
import { IconCamera } from '../../components/icons'
import { api, ApiError } from '../../lib/api'
import {
  AMOUNT_FIELDS,
  emptyAmounts,
  emptyRow,
  isEmptyRow,
  itemSummary,
  itemsPayload,
  missingItemDetails,
  rowFromItem,
  sameValue,
  totalQuantity,
  type AmountKey,
  type Amounts,
  type ItemRow,
  type Mark,
} from '../../lib/bill'
import { compressImage } from '../../lib/compressImage'
import { billForm, queueUpload, type QueuedUploadDetails } from '../../lib/offlineQueue'
import { readBill, type ReadText } from '../../lib/readBill'

const TEXT_FIELDS: ReadText[] = ['vendor', 'invoiceNumber', 'billDate', 'poNumber']

export function DeliveryDetails() {
  const { projectId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const file = (location.state as { file?: File } | null)?.file ?? null

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [vendor, setVendor] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [billDate, setBillDate] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()])
  const [amounts, setAmounts] = useState<Amounts>(emptyAmounts)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  // The shrunk photo (made once, then read and sent), and what reading it filled in.
  const [photo, setPhoto] = useState<File | null>(null)
  const [reading, setReading] = useState<'idle' | 'reading' | 'filled' | 'none'>('idle')
  const [scanId, setScanId] = useState<number | null>(null)
  const [marks, setMarks] = useState<Partial<Record<ReadText | AmountKey, Mark>>>({})
  // What the photo said, to mark a value the supervisor then changed as EDITED.
  const [readValues, setReadValues] = useState<Partial<Record<ReadText | AmountKey, string>>>({})
  const typed = useRef({ text: { vendor, invoiceNumber, billDate, poNumber }, rows, amounts })

  useEffect(() => {
    typed.current = { text: { vendor, invoiceNumber, billDate, poNumber }, rows, amounts }
  }, [vendor, invoiceNumber, billDate, poNumber, rows, amounts])

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Read the bill as soon as it's shown, and fill in only what hasn't been typed yet. With no
  // signal (or if reading isn't set up on the server) nothing changes: the details are typed in.
  useEffect(() => {
    if (!file) return
    let cancelled = false
    void (async () => {
      const shrunk = await compressImage(file)
      if (cancelled) return
      setPhoto(shrunk)
      if (!navigator.onLine) return
      setReading('reading')
      const result = await readBill(shrunk)
      if (cancelled) return
      if (!result) {
        setReading('none')
        return
      }
      setScanId(result.scanId)
      const markOf = (confidence: number) => (confidence < result.lowConfidence ? ('check' as const) : ('read' as const))
      const { fields } = result
      const filled: Partial<Record<ReadText | AmountKey, Mark>> = {}
      const asRead: Partial<Record<ReadText | AmountKey, string>> = {}

      const textSetters: Record<ReadText, (value: string) => void> = {
        vendor: setVendor,
        invoiceNumber: setInvoiceNumber,
        billDate: setBillDate,
        poNumber: setPoNumber,
      }
      for (const key of TEXT_FIELDS) {
        const found = fields[key]
        if (!found || typed.current.text[key].trim()) continue
        textSetters[key](found.value)
        filled[key] = markOf(found.confidence)
        asRead[key] = found.value
      }
      const readAmounts: Partial<Amounts> = {}
      for (const { key } of AMOUNT_FIELDS) {
        const found = fields[key]
        if (!found || typed.current.amounts[key].trim()) continue
        readAmounts[key] = String(found.value)
        filled[key] = markOf(found.confidence)
        asRead[key] = String(found.value)
      }
      setAmounts((current) => ({ ...current, ...readAmounts }))

      let readRows = false
      if (fields.items?.value.length && typed.current.rows.every(isEmptyRow)) {
        setRows(fields.items.value.map((row) => ({ ...rowFromItem(row), mark: markOf(row.confidence) })))
        readRows = true
      }
      setMarks(filled)
      setReadValues(asRead)
      setReading(readRows || Object.keys(filled).length > 0 ? 'filled' : 'none')
    })()
    return () => {
      cancelled = true
    }
  }, [file])

  if (!file) return <Navigate to={`/supervisor/projects/${projectId}/upload`} replace />

  // A value the photo filled in is marked as read (or unclear); once changed, as EDITED.
  const current: Record<ReadText | AmountKey, string> = { vendor, invoiceNumber, billDate, poNumber, ...amounts }
  function markFor(key: ReadText | AmountKey): Mark | undefined {
    const asRead = readValues[key]
    return asRead !== undefined && !sameValue(current[key], asRead) ? 'edited' : marks[key]
  }
  const amountMarks = Object.fromEntries(AMOUNT_FIELDS.map(({ key }) => [key, markFor(key)]))

  const missingFields: string[] = []
  if (!vendor.trim()) missingFields.push('vendor')
  missingFields.push(...missingItemDetails(rows))

  async function handleSubmit() {
    if (missingFields.length > 0) {
      setShowErrors(true)
      return
    }

    setUploading(true)
    setError(null)
    const successPath = `/supervisor/projects/${projectId}/success`
    const delivered = totalQuantity(rows)
    const details: QueuedUploadDetails = {
      vendor,
      item: itemSummary(rows),
      delivered: delivered === null ? '' : String(delivered),
      poNumber,
      items: JSON.stringify(itemsPayload(rows)),
      invoiceNumber,
      billDate,
      ...amounts,
      ocrScanId: scanId ?? undefined,
    }
    const shrunk = photo ?? (await compressImage(file!))
    const filename = shrunk.name || 'bill.jpg'

    if (!navigator.onLine) {
      await queueUpload(projectId, shrunk, filename, details)
      navigate(successPath, { state: { queued: true } })
      return
    }

    try {
      await api.post(`/api/projects/${projectId}/deliveries`, billForm(shrunk, filename, details))
      navigate(successPath)
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Could not upload that photo. Try again.')
        setUploading(false)
        return
      }
      await queueUpload(projectId, shrunk, filename, details)
      navigate(successPath, { state: { queued: true } })
    }
  }

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ScreenHeader backTo={`/supervisor/projects/${projectId}/upload`} title="Bill details" subtitle="Step 2 of 2 · copy from the bill" />

      <div className="flex-grow px-5 pt-2 pb-4 flex flex-col gap-5">
        <div className="flex flex-col gap-3">
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

          <div className="text-[12.5px] text-ink-muted leading-relaxed px-1" aria-live="polite">
            {reading === 'reading'
              ? 'Reading the bill… You can start typing meanwhile.'
              : reading === 'filled'
                ? 'Filled in from the photo. Check each one against the bill before sending.'
                : 'Copy these from the bill. The office team will check them against the purchase order.'}
          </div>
        </div>

        <div>
          <SectionLabel title="Bill" />
          <div className="flex flex-col gap-3.5">
            <Field
              id="vendor"
              label={<MarkedLabel label="Vendor" mark={markFor('vendor')} />}
              placeholder="e.g. UltraTech Cement Ltd"
              invalid={markFor('vendor') === 'check' || (showErrors && !vendor.trim())}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="invoice-number"
                label={<MarkedLabel label="Bill no." mark={markFor('invoiceNumber')} />}
                placeholder="If printed"
                invalid={markFor('invoiceNumber') === 'check'}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
              <Field
                id="bill-date"
                label={<MarkedLabel label="Bill date" mark={markFor('billDate')} />}
                type="date"
                invalid={markFor('billDate') === 'check'}
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </div>
            <Field
              id="po"
              label={<MarkedLabel label="PO number" mark={markFor('poNumber')} />}
              placeholder="If known"
              invalid={markFor('poNumber') === 'check'}
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
          </div>
        </div>

        <ItemsEditor rows={rows} onChange={setRows} showErrors={showErrors} />

        <AmountsCard
          amounts={amounts}
          marks={amountMarks}
          onChange={(key, value) => setAmounts((before) => ({ ...before, [key]: value }))}
        />
      </div>

      <div className="sticky bottom-0 z-10 px-3 pb-[calc(0.75rem+var(--safe-bottom))] pt-2">
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
