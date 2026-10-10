import { Image } from 'expo-image'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { AmountsCard, DateField, ItemsEditor, MarkedLabel, SectionLabel } from '../../../../components/BillParts'
import { ActionBar, Frost, FrostBackdrop, FrostScope } from '../../../../components/Frost'
import { SCREEN_HEADER_HEIGHT, ScreenHeader } from '../../../../components/headers'
import { IconCamera } from '../../../../components/icons'
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
import { compressImage } from '../../../../lib/compressImage'
import { billForm, isOnline, queueUpload, type QueuedUploadDetails } from '../../../../lib/offlineQueue'
import { readBill, type ReadText } from '../../../../lib/readBill'
import { colors, ring } from '../../../../lib/theme'

const TEXT_FIELDS: ReadText[] = ['vendor', 'invoiceNumber', 'billDate', 'poNumber']

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
  // The shrunk photo (made once, then read and sent), and what reading it filled in.
  const [photo, setPhoto] = useState<{ uri: string; filename: string } | null>(null)
  const [reading, setReading] = useState<'idle' | 'reading' | 'filled' | 'none'>('idle')
  const [scanId, setScanId] = useState<number | null>(null)
  const [marks, setMarks] = useState<Partial<Record<ReadText | AmountKey, Mark>>>({})
  // What the photo said, to mark a value the supervisor then changed as EDITED.
  const [readValues, setReadValues] = useState<Partial<Record<ReadText | AmountKey, string>>>({})
  const typed = useRef({ text: { vendor, invoiceNumber, billDate, poNumber }, rows, amounts })

  useEffect(() => {
    typed.current = { text: { vendor, invoiceNumber, billDate, poNumber }, rows, amounts }
  }, [vendor, invoiceNumber, billDate, poNumber, rows, amounts])

  // Read the bill as soon as it's shown, and fill in only what hasn't been typed yet. With no
  // signal (or if reading isn't set up on the server) nothing changes: the details are typed in.
  useEffect(() => {
    if (!params.uri) return
    let cancelled = false
    void (async () => {
      const shrunk = await compressImage({
        uri: params.uri!,
        width: Number(params.width) || 0,
        height: Number(params.height) || 0,
        fileName: params.fileName || null,
      })
      if (cancelled) return
      setPhoto(shrunk)
      if (!(await isOnline())) return
      setReading('reading')
      const result = await readBill(shrunk.uri, shrunk.filename)
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
  }, [params.uri, params.width, params.height, params.fileName])

  if (!params.uri) return <Redirect href={`/supervisor/projects/${projectId}/upload`} />

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
    const shrunk =
      photo ??
      (await compressImage({
        uri: params.uri!,
        width: Number(params.width) || 0,
        height: Number(params.height) || 0,
        fileName: params.fileName || null,
      }))

    if (!(await isOnline())) {
      await queueUpload(projectId, shrunk.uri, shrunk.filename, details)
      router.replace({ pathname: '/supervisor/projects/[projectId]/success', params: { projectId, queued: '1' } })
      return
    }

    try {
      await api.post(`/api/projects/${projectId}/deliveries`, billForm(shrunk.uri, shrunk.filename, details))
      router.replace(`/supervisor/projects/${projectId}/success`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Could not upload that photo. Try again.')
        setUploading(false)
        return
      }
      await queueUpload(projectId, shrunk.uri, shrunk.filename, details)
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
                        <Image source={{ uri: params.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="The bill you photographed" />
                      </FrostBackdrop>
                      <Tap onPress={() => router.back()} style={styles.retake}>
                        <Frost blur={8} tint="rgba(0, 0, 0, 0.45)" style={{ borderRadius: 999 }} />
                        <IconCamera size={14} stroke={colors.white} />
                        <T size={12} weight={700} color={colors.white}>
                          Retake
                        </T>
                      </Tap>
                    </FrostScope>
                  </View>
                </Card>

                <T size={12.5} lh={1.625} color={colors.inkMuted} style={{ paddingHorizontal: 4 }} accessibilityLiveRegion="polite">
                  {reading === 'reading'
                    ? 'Reading the bill… You can start typing meanwhile.'
                    : reading === 'filled'
                      ? 'Filled in from the photo. Check each one against the bill before sending.'
                      : 'Copy these from the bill. The office team will check them against the purchase order.'}
                </T>
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
})
