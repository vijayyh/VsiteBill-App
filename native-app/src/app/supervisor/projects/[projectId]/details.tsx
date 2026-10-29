import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { AmountsCard, DateField, ItemsEditor, MarkedLabel, SectionLabel } from '../../../../components/BillParts'
import { ActionBar, Frost, FrostBackdrop, FrostScope } from '../../../../components/Frost'
import { SCREEN_HEADER_HEIGHT, ScreenHeader } from '../../../../components/headers'
import { IconCamera, IconClose, IconGallery } from '../../../../components/icons'
import { PageBackground, Screen } from '../../../../components/Screen'
import { T } from '../../../../components/T'
import { Card, Field, PrimaryButton, Tap } from '../../../../components/ui'
import { api, ApiError } from '../../../../lib/api'
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
} from '../../../../lib/bill'
import { compressImage, type Photo } from '../../../../lib/compressImage'
import { billForm, isOnline, queueUpload, type QueuedUploadDetails } from '../../../../lib/offlineQueue'
import { readBill, type ReadText } from '../../../../lib/readBill'
import { colors, ring } from '../../../../lib/theme'

const TEXT_FIELDS: ReadText[] = ['vendor', 'invoiceNumber', 'billDate', 'poNumber']
// Pages one bill can have (the server's MAX_BILL_PAGES).
const MAX_PAGES = 10

/** The rows as text (without their read marks), to tell whether they changed since a reading. */
function rowsKey(rows: ItemRow[]) {
  return JSON.stringify(itemsPayload(rows))
}

function pageFrom(asset: ImagePicker.ImagePickerAsset): Photo {
  return { uri: asset.uri, width: asset.width, height: asset.height, fileName: asset.fileName ?? null }
}

// Same as the web app's bill details form (frontend/src/screens/supervisor/DeliveryDetails.tsx):
// the photo is read as soon as it's shown and fills in what hasn't been typed yet; with no signal
// (or if sending fails on the way), the bill is saved on the phone and sent later.
export default function DeliveryDetails() {
  const params = useLocalSearchParams<{ projectId: string; uri: string; width: string; height: string; fileName: string }>()
  const projectId = params.projectId ?? ''
  const [vendor, setVendor] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [billDate, setBillDate] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()])
  const [amounts, setAmounts] = useState<Amounts>(emptyAmounts)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [barHeight, setBarHeight] = useState(0)
  // The bill's pages, in order: the photo chosen on the previous screen, then any added here.
  const [pages, setPages] = useState<Photo[]>(() =>
    params.uri
      ? [{ uri: params.uri, width: Number(params.width) || 0, height: Number(params.height) || 0, fileName: params.fileName || null }]
      : [],
  )
  const [shownPage, setShownPage] = useState(0)
  const [failedPages, setFailedPages] = useState<number[]>([])
  // How many pages the last reading that worked covered.
  const [readCount, setReadCount] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  // Each page is shrunk once, then read (with the others) and sent.
  const shrunk = useRef(new Map<string, Promise<{ uri: string; filename: string }>>())
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

  function shrink(page: Photo) {
    let made = shrunk.current.get(page.uri)
    if (!made) {
      made = compressImage(page)
      shrunk.current.set(page.uri, made)
    }
    return made
  }

  // Read the bill as soon as it's shown, and fill in only what hasn't been typed yet. With no
  // signal (or if reading isn't set up on the server) nothing changes: the details are typed in.
  // When a page is added or removed, every page is read again (as one bill) a moment later.
  useEffect(() => {
    if (pages.length === 0) return
    let cancelled = false
    const firstReading = lastFill.current.rows === null && Object.keys(lastFill.current.values).length === 0
    const timer = setTimeout(
      () =>
        void (async () => {
          const photos = await Promise.all(pages.map(shrink))
          if (cancelled || !(await isOnline())) return
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
      firstReading && pages.length === 1 ? 0 : 1200,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // shrink only reads a ref; reading again is for a change of pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages])

  if (!params.uri) return <Redirect href={`/supervisor/projects/${projectId}/upload`} />

  function addPages(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return
    const added = result.assets.slice(0, MAX_PAGES - pages.length).map(pageFrom)
    if (added.length === 0) return
    setPages((before) => [...before, ...added])
    setShownPage(pages.length)
  }

  async function addPageWithCamera() {
    setProblem(null)
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setProblem('Camera access is off. Allow it in the phone’s settings to photograph bills.')
      return
    }
    addPages(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }))
  }

  async function addPagesFromGallery() {
    setProblem(null)
    addPages(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: MAX_PAGES - pages.length,
      }),
    )
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
    const [first, ...morePages] = await Promise.all(pages.map(shrink))

    if (!(await isOnline())) {
      await queueUpload(projectId, first.uri, first.filename, details, morePages)
      router.replace({ pathname: '/supervisor/projects/[projectId]/success', params: { projectId, queued: '1' } })
      return
    }

    try {
      await api.post(`/api/projects/${projectId}/deliveries`, billForm(first.uri, first.filename, details, morePages))
      router.replace(`/supervisor/projects/${projectId}/success`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(pages.length > 1 ? 'Could not upload those photos. Try again.' : 'Could not upload that photo. Try again.')
        setUploading(false)
        return
      }
      await queueUpload(projectId, first.uri, first.filename, details, morePages)
      router.replace({ pathname: '/supervisor/projects/[projectId]/success', params: { projectId, queued: '1' } })
    }
  }

  return (
    <Screen>
      <FrostScope>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FrostBackdrop style={{ flex: 1 }}>
            <PageBackground />
            <ScrollView
              contentContainerStyle={{ paddingTop: SCREEN_HEADER_HEIGHT + 8, paddingHorizontal: 20, paddingBottom: 16 + barHeight, gap: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ gap: 12 }}>
                <Card style={{ padding: 6 }}>
                  <View style={styles.preview}>
                    {/* The photo is the backdrop the frosted Retake pill blurs. */}
                    <FrostScope>
                      <FrostBackdrop style={StyleSheet.absoluteFill}>
                        <Image
                          source={{ uri: pages[shownPage]?.uri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          accessibilityLabel={pages.length > 1 ? `Page ${shownPage + 1} of the bill` : 'The bill you photographed'}
                        />
                      </FrostBackdrop>
                      {pages.length > 1 ? (
                        <View style={styles.pageLabel}>
                          <Frost blur={8} tint="rgba(0, 0, 0, 0.45)" style={{ borderRadius: 999 }} />
                          <T size={12} weight={700} color={colors.white}>
                            Page {shownPage + 1} of {pages.length}
                          </T>
                        </View>
                      ) : (
                        <Tap onPress={() => router.back()} style={styles.retake}>
                          <Frost blur={8} tint="rgba(0, 0, 0, 0.45)" style={{ borderRadius: 999 }} />
                          <IconCamera size={14} stroke={colors.white} />
                          <T size={12} weight={700} color={colors.white}>
                            Retake
                          </T>
                        </Tap>
                      )}
                    </FrostScope>
                  </View>

                  {/* The bill's pages: tap one to see it, × to take it out, + for the next page. */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                    {pages.map((page, i) => (
                      <View key={page.uri} style={styles.pageThumbWrap}>
                        <Tap
                          onPress={() => setShownPage(i)}
                          accessibilityLabel={`Show page ${i + 1}`}
                          style={[styles.pageThumb, i === shownPage && { borderColor: colors.accent }]}
                        >
                          <Image source={{ uri: page.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                          <View style={styles.pageNumber}>
                            <T size={10} weight={700} color={colors.white}>
                              {i + 1}
                            </T>
                          </View>
                        </Tap>
                        {pages.length > 1 ? (
                          <Tap onPress={() => removePage(i)} accessibilityLabel={`Remove page ${i + 1}`} hitSlop={6} style={styles.removePage}>
                            <IconClose size={10} stroke={colors.white} />
                          </Tap>
                        ) : null}
                      </View>
                    ))}
                    {pages.length < MAX_PAGES ? (
                      <View style={styles.addPage}>
                        <T size={11.5} weight={600} color={colors.inkMuted}>
                          Add page
                        </T>
                        <Tap onPress={() => void addPageWithCamera()} accessibilityLabel="Add a page with the camera" style={styles.addPageButton}>
                          <IconCamera size={18} stroke={colors.accent} />
                        </Tap>
                        <Tap onPress={() => void addPagesFromGallery()} accessibilityLabel="Add pages from the gallery" style={styles.addPageButton}>
                          <IconGallery size={18} stroke={colors.accent} />
                        </Tap>
                      </View>
                    ) : null}
                  </ScrollView>
                </Card>

                <T size={12.5} lh={1.625} color={colors.inkMuted} style={{ paddingHorizontal: 4 }} accessibilityLiveRegion="polite">
                  {reading === 'reading'
                    ? pages.length > 1
                      ? `Reading all ${pages.length} pages… You can start typing meanwhile.`
                      : 'Reading the bill… You can start typing meanwhile.'
                    : reading === 'filled'
                      ? readCount > 1
                        ? `Filled in from the ${readCount} pages. Check each one against the bill before sending.`
                        : 'Filled in from the photo. Check each one against the bill before sending.'
                      : 'Copy these from the bill. The office team will check them against the purchase order.'}
                </T>
                {failedPages.length > 0 && reading !== 'reading' ? (
                  <T size={12.5} weight={600} lh={1.625} color={colors.warningText} style={{ paddingHorizontal: 4 }}>
                    {failedPages.length === 1 ? `Page ${failedPages[0]} couldn't be read` : `Pages ${failedPages.join(', ')} couldn't be read`}
                    {`: type in what's on ${failedPages.length === 1 ? 'it' : 'them'}.`}
                  </T>
                ) : null}
                {problem ? (
                  <T size={12.5} weight={600} color={colors.warningText} style={{ paddingHorizontal: 4 }}>
                    {problem}
                  </T>
                ) : null}
              </View>

              <View>
                <SectionLabel title="Bill" />
                <View style={{ gap: 14 }}>
                  <Field
                    label={<MarkedLabel label="Vendor" mark={markFor('vendor')} />}
                    placeholder="e.g. UltraTech Cement Ltd"
                    invalid={markFor('vendor') === 'check' || (showErrors && !vendor.trim())}
                    value={vendor}
                    onChangeText={setVendor}
                  />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Field
                      style={{ flex: 1 }}
                      label={<MarkedLabel label="Bill no." mark={markFor('invoiceNumber')} />}
                      placeholder="If printed"
                      invalid={markFor('invoiceNumber') === 'check'}
                      value={invoiceNumber}
                      onChangeText={setInvoiceNumber}
                    />
                    <DateField
                      style={{ flex: 1 }}
                      label={<MarkedLabel label="Bill date" mark={markFor('billDate')} />}
                      invalid={markFor('billDate') === 'check'}
                      value={billDate}
                      onChange={setBillDate}
                    />
                  </View>
                  <Field
                    label={<MarkedLabel label="PO number" mark={markFor('poNumber')} />}
                    placeholder="If known"
                    invalid={markFor('poNumber') === 'check'}
                    value={poNumber}
                    onChangeText={setPoNumber}
                  />
                </View>
              </View>

              <ItemsEditor rows={rows} onChange={setRows} showErrors={showErrors} />

              <AmountsCard amounts={amounts} marks={amountMarks} onChange={(key, value) => setAmounts((before) => ({ ...before, [key]: value }))} />
            </ScrollView>
          </FrostBackdrop>

          <ActionBar onHeight={setBarHeight}>
            {error ? (
              <T size={12.5} weight={600} color={colors.warningText} style={styles.barMessage}>
                {error}
              </T>
            ) : null}
            {showErrors && missingFields.length > 0 ? (
              <T size={12.5} weight={600} color={colors.warningText} style={styles.barMessage}>
                Fill in {missingFields.join(', ')} before sending.
              </T>
            ) : null}
            <PrimaryButton onPress={() => void handleSubmit()} disabled={uploading} style={{ paddingVertical: 16 }}>
              <T size={15} weight={700} color={colors.white}>
                {uploading ? 'Sending…' : 'Send to office'}
              </T>
            </PrimaryButton>
          </ActionBar>
        </KeyboardAvoidingView>
        <ScreenHeader title="Bill details" subtitle="Step 2 of 2 · copy from the bill" />
      </FrostScope>
    </Screen>
  )
}

const styles = StyleSheet.create({
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: colors.cameraBg, overflow: 'hidden' },
  retake: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    ...ring(1, 'rgba(255,255,255,0.3)'),
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  barMessage: { textAlign: 'center', paddingTop: 4 },
  pageLabel: {
    position: 'absolute',
    left: 10,
    top: 10,
    borderRadius: 999,
    ...ring(1, 'rgba(255,255,255,0.3)'),
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
  pageThumbWrap: { paddingTop: 6, paddingRight: 6 },
  pageThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: colors.cameraBg,
  },
  pageNumber: {
    position: 'absolute',
    left: 2,
    bottom: 2,
    minWidth: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  removePage: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    ...ring(2, colors.white),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPage: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingLeft: 4 },
  addPageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    ...ring(1, colors.white),
    alignItems: 'center',
    justifyContent: 'center',
  },
})
