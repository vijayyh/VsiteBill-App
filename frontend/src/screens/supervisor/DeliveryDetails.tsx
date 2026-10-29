import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AmountsCard, ItemsEditor, MarkedLabel, SectionLabel } from '../../components/BillParts'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Field, btnPrimary } from '../../components/ui'
import { IconCamera, IconClose, IconGallery } from '../../components/icons'
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
// Pages one bill can have (the server's MAX_BILL_PAGES).
const MAX_PAGES = 10

/** The rows as text (without their read marks), to tell whether they changed since a reading. */
function rowsKey(rows: ItemRow[]) {
  return JSON.stringify(itemsPayload(rows))
}

export function DeliveryDetails() {
  const { projectId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { file = null, fromProject = false } = (location.state as { file?: File; fromProject?: boolean } | null) ?? {}

  // The bill's pages, in order: the photo chosen on the previous screen, then any added here.
  const [pages, setPages] = useState<File[]>(() => (file ? [file] : []))
  const [shownPage, setShownPage] = useState(0)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [failedPages, setFailedPages] = useState<number[]>([])
  // How many pages the last reading that worked covered.
  const [readCount, setReadCount] = useState(0)
  const addCameraInput = useRef<HTMLInputElement>(null)
  const addGalleryInput = useRef<HTMLInputElement>(null)
  // Each page is shrunk once, then read (with the others) and sent.
  const shrunk = useRef(new Map<File, Promise<File>>())
  const [vendor, setVendor] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [billDate, setBillDate] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()])
  const [amounts, setAmounts] = useState<Amounts>(emptyAmounts)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  // What reading the pages filled in.
  const [reading, setReading] = useState<'idle' | 'reading' | 'filled' | 'none'>('idle')
  const [scanId, setScanId] = useState<number | null>(null)
  const [marks, setMarks] = useState<Partial<Record<ReadText | AmountKey, Mark>>>({})
  // What the photo said, to mark a value the supervisor then changed as EDITED.
  const [readValues, setReadValues] = useState<Partial<Record<ReadText | AmountKey, string>>>({})
  const typed = useRef({ text: { vendor, invoiceNumber, billDate, poNumber }, rows, amounts })
  // What the last reading put in each field (and the rows), so reading again after a page is
  // added or removed updates only what the supervisor hasn't changed since.
  const lastFill = useRef<{ values: Partial<Record<ReadText | AmountKey, string>>; rows: string | null }>({
    values: {},
    rows: null,
  })

  useEffect(() => {
    typed.current = { text: { vendor, invoiceNumber, billDate, poNumber }, rows, amounts }
  }, [vendor, invoiceNumber, billDate, poNumber, rows, amounts])

  useEffect(() => {
    const urls = pages.map((page) => URL.createObjectURL(page))
    setPreviewUrls(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [pages])

  function shrink(page: File) {
    let made = shrunk.current.get(page)
    if (!made) {
      made = compressImage(page)
      shrunk.current.set(page, made)
    }
    return made
  }

  // Read the bill as soon as it's shown, and fill in only what hasn't been typed yet. With no
  // signal (or if reading isn't set up on the server) nothing changes: the details are typed in.
  // When a page is added or removed, every page is read again (as one bill) a moment later.
  useEffect(() => {
    if (pages.length === 0) return
    let cancelled = false
    const timer = window.setTimeout(
      () =>
        void (async () => {
          const photos = await Promise.all(pages.map(shrink))
          if (cancelled || !navigator.onLine) return
          setReading('reading')
          const result = await readBill(photos)
          if (cancelled) return
          if (!result) {
            const filledBefore = lastFill.current.rows !== null || Object.keys(lastFill.current.values).length > 0
            // What an earlier reading filled in stays; the pages added since weren't read.
            if (filledBefore) setFailedPages(pages.map((_, i) => i + 1).slice(readCount))
            setReading(filledBefore ? 'filled' : 'none')
            return
          }
          setScanId(result.scanId)
          setReadCount(pages.length - (result.failedPages?.length ?? 0))
          setFailedPages(result.failedPages ?? [])
          const markOf = (confidence: number) =>
            confidence < result.lowConfidence ? ('check' as const) : ('read' as const)
          const { fields } = result
          const filled: Partial<Record<ReadText | AmountKey, Mark>> = {}
          const asRead: Partial<Record<ReadText | AmountKey, string>> = {}
          // Empty, or still as the last reading left it.
          const free = (key: ReadText | AmountKey, current: string) =>
            !current.trim() || current === lastFill.current.values[key]

          const textSetters: Record<ReadText, (value: string) => void> = {
            vendor: setVendor,
            invoiceNumber: setInvoiceNumber,
            billDate: setBillDate,
            poNumber: setPoNumber,
          }
          for (const key of TEXT_FIELDS) {
            const found = fields[key]
            if (!found || !free(key, typed.current.text[key])) continue
            textSetters[key](found.value)
            filled[key] = markOf(found.confidence)
            asRead[key] = found.value
          }
          const readAmounts: Partial<Amounts> = {}
          for (const { key } of AMOUNT_FIELDS) {
            const found = fields[key]
            if (!found || !free(key, typed.current.amounts[key])) continue
            readAmounts[key] = String(found.value)
            filled[key] = markOf(found.confidence)
            asRead[key] = String(found.value)
          }
          setAmounts((current) => ({ ...current, ...readAmounts }))

          let readRows = false
          const rowsUntouched =
            typed.current.rows.every(isEmptyRow) || rowsKey(typed.current.rows) === lastFill.current.rows
          if (fields.items?.value.length && rowsUntouched) {
            const newRows = fields.items.value.map((row) => ({ ...rowFromItem(row), mark: markOf(row.confidence) }))
            setRows(newRows)
            lastFill.current.rows = rowsKey(newRows)
            readRows = true
          }
          lastFill.current.values = { ...lastFill.current.values, ...asRead }
          setMarks((before) => ({ ...before, ...filled }))
          setReadValues((before) => ({ ...before, ...asRead }))
          const anyFilled = readRows || lastFill.current.rows !== null || Object.keys(lastFill.current.values).length > 0
          setReading(anyFilled ? 'filled' : 'none')
        })(),
      lastFill.current.rows === null && Object.keys(lastFill.current.values).length === 0 && pages.length === 1 ? 0 : 1200,
    )
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // shrink only reads a ref; reading again is for a change of pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages])

  if (!file) return <Navigate to={`/supervisor/projects/${projectId}/upload`} replace />

  function addPages(e: React.ChangeEvent<HTMLInputElement>) {
    const added = Array.from(e.target.files ?? []).slice(0, MAX_PAGES - pages.length)
    e.target.value = '' // so the same photo can be chosen again after removing it
    if (added.length === 0) return
    setPages((before) => [...before, ...added])
    setShownPage(pages.length)
  }

  function removePage(index: number) {
    setPages((before) => before.filter((_, i) => i !== index))
    setShownPage((shown) => Math.max(0, shown > index || shown === pages.length - 1 ? shown - 1 : shown))
  }

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
    // Every page, in order, sent (or saved on the phone) together as this one bill.
    const [first, ...rest] = await Promise.all(pages.map(shrink))
    const filename = first.name || 'bill.jpg'
    const morePages = rest.map((page, i) => ({ blob: page, filename: page.name || `bill-page-${i + 2}.jpg` }))

    // The confirmation takes this form's place, so back from it goes to the project, not to a
    // form that would send the same bill again.
    if (!navigator.onLine) {
      await queueUpload(projectId, first, filename, details, morePages)
      navigate(successPath, { state: { queued: true, fromProject }, replace: true })
      return
    }

    try {
      await api.post(`/api/projects/${projectId}/deliveries`, billForm(first, filename, details, morePages))
      navigate(successPath, { state: { fromProject }, replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(pages.length > 1 ? 'Could not upload those photos. Try again.' : 'Could not upload that photo. Try again.')
        setUploading(false)
        return
      }
      await queueUpload(projectId, first, filename, details, morePages)
      navigate(successPath, { state: { queued: true, fromProject }, replace: true })
    }
  }

  return (
    <div className="flex flex-col flex-grow text-ink">
      <ScreenHeader backTo={`/supervisor/projects/${projectId}/upload`} title="Bill details" subtitle="Step 2 of 2 · copy from the bill" />

      <div className="flex-grow px-5 pt-2 pb-4 flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="glass rounded-card p-1.5">
            <div className="relative w-full aspect-[4/3] rounded-[14px] bg-camera-bg overflow-hidden">
              {previewUrls[shownPage] && (
                <img
                  src={previewUrls[shownPage]}
                  alt={pages.length > 1 ? `Page ${shownPage + 1} of the bill` : 'The bill you photographed'}
                  className="w-full h-full object-cover"
                />
              )}
              {pages.length > 1 ? (
                <span className="absolute top-2.5 left-2.5 rounded-full bg-black/45 ring-1 ring-white/30 backdrop-blur text-white text-[12px] font-bold px-3 py-1.5">
                  Page {shownPage + 1} of {pages.length}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/supervisor/projects/${projectId}/upload`, { state: { fromProject }, replace: true })}
                  className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/45 ring-1 ring-white/30 backdrop-blur text-white text-[12px] font-bold px-3 py-1.5"
                >
                  <IconCamera size={14} stroke="#FFFFFF" />
                  Retake
                </button>
              )}
            </div>

            {/* The bill's pages: tap one to see it, × to take it out, + for the next page. */}
            <div className="flex items-center gap-2 overflow-x-auto px-1 pt-2 pb-1">
              {previewUrls.map((url, i) => (
                <div key={url} className="relative flex-shrink-0 pt-1.5 pr-1.5">
                  <button
                    type="button"
                    onClick={() => setShownPage(i)}
                    aria-label={`Show page ${i + 1}`}
                    aria-current={i === shownPage}
                    className={`relative block w-12 h-12 rounded-[10px] overflow-hidden ring-2 ${
                      i === shownPage ? 'ring-accent' : 'ring-white/80'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0.5 left-0.5 min-w-4 rounded-full bg-black/55 text-white text-[10px] font-bold leading-4 px-1">
                      {i + 1}
                    </span>
                  </button>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePage(i)}
                      aria-label={`Remove page ${i + 1}`}
                      className="absolute top-0 right-0 w-5 h-5 rounded-full bg-ink ring-2 ring-white flex items-center justify-center"
                    >
                      <IconClose size={10} stroke="#FFFFFF" />
                    </button>
                  )}
                </div>
              ))}
              {pages.length < MAX_PAGES && (
                <div className="flex-shrink-0 flex items-center gap-1.5 pt-1.5 pl-1">
                  <span className="text-[11.5px] font-semibold text-ink-muted whitespace-nowrap">Add page</span>
                  <button
                    type="button"
                    onClick={() => addCameraInput.current?.click()}
                    aria-label="Add a page with the camera"
                    className="w-10 h-10 rounded-full bg-white/80 ring-1 ring-white flex items-center justify-center"
                  >
                    <IconCamera size={18} stroke="var(--color-accent)" />
                  </button>
                  <button
                    type="button"
                    onClick={() => addGalleryInput.current?.click()}
                    aria-label="Add pages from the gallery"
                    className="w-10 h-10 rounded-full bg-white/80 ring-1 ring-white flex items-center justify-center"
                  >
                    <IconGallery size={18} stroke="var(--color-accent)" />
                  </button>
                  <input ref={addCameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={addPages} />
                  <input ref={addGalleryInput} type="file" accept="image/*" multiple className="hidden" onChange={addPages} />
                </div>
              )}
            </div>
          </div>

          <div className="text-[12.5px] text-ink-muted leading-relaxed px-1" aria-live="polite">
            {reading === 'reading'
              ? pages.length > 1
                ? `Reading all ${pages.length} pages… You can start typing meanwhile.`
                : 'Reading the bill… You can start typing meanwhile.'
              : reading === 'filled'
                ? readCount > 1
                  ? `Filled in from the ${readCount} pages. Check each one against the bill before sending.`
                  : 'Filled in from the photo. Check each one against the bill before sending.'
                : 'Copy these from the bill. The office team will check them against the purchase order.'}
          </div>
          {failedPages.length > 0 && reading !== 'reading' && (
            <div className="text-[12.5px] font-semibold text-warning-text leading-relaxed px-1" role="status">
              {failedPages.length === 1 ? `Page ${failedPages[0]} couldn't be read` : `Pages ${failedPages.join(', ')} couldn't be read`}
              : type in what's on {failedPages.length === 1 ? 'it' : 'them'}.
            </div>
          )}
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
