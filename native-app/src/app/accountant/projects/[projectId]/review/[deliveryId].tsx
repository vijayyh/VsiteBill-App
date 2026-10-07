import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { AuthImage } from '../../../../../components/AuthImage'
import { StatusBadge } from '../../../../../components/bills'
import { ActionBar, Frost, FrostBackdrop, FrostScope } from '../../../../../components/Frost'
import { SCREEN_HEADER_HEIGHT, ScreenHeader } from '../../../../../components/headers'
import { IconAlertTriangle, IconCamera, IconCheck, IconClipboardCheck, IconCloud } from '../../../../../components/icons'
import { PhotoViewer } from '../../../../../components/PhotoViewer'
import { PageBackground, Screen } from '../../../../../components/Screen'
import { T } from '../../../../../components/T'
import { Card, Field, PrimaryButton, SecondaryButton, Tap } from '../../../../../components/ui'
import { api, ApiError, useApiGet } from '../../../../../lib/api'
import { formatDateTime } from '../../../../../lib/format'
import { colors, fonts, glassStrong, radii, ring } from '../../../../../lib/theme'
import type { Delivery, Project } from '../../../../../lib/types'

// Same as the web app's bill review (frontend/src/screens/accountant/ReviewDelivery.tsx). Back and
// save return to wherever the bill was opened from (Home, the Review queue, Alerts or the gallery).
export default function ReviewDelivery() {
  const { projectId = '', deliveryId = '' } = useLocalSearchParams<{ projectId: string; deliveryId: string }>()
  const projectQuery = useApiGet<{ project: Project }>(`/api/projects/${projectId}`)
  const deliveryQuery = useApiGet<{ delivery: Delivery }>(`/api/deliveries/${deliveryId}`)

  const [vendor, setVendor] = useState('')
  const [item, setItem] = useState('')
  const [orderedQty, setOrderedQty] = useState('')
  const [quantity, setQuantity] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [note, setNote] = useState('')
  const [noteFocused, setNoteFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [savingToDrive, setSavingToDrive] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [barHeight, setBarHeight] = useState(0)

  const delivery = deliveryQuery.data?.delivery
  const project = projectQuery.data?.project
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/accountant/projects/${projectId}/gallery`))

  // Fill the form when a bill loads — only a different bill, not a refresh after "Save to Drive".
  const [formFor, setFormFor] = useState<number | null>(null)
  if (delivery && delivery.id !== formFor) {
    setFormFor(delivery.id)
    setVendor(delivery.vendor)
    setItem(delivery.item)
    setOrderedQty(delivery.ordered != null ? String(delivery.ordered) : '')
    setQuantity(delivery.delivered != null ? String(delivery.delivered) : '')
    setPoNumber(delivery.poNumber ?? '')
    setNote(delivery.note ?? '')
  }

  if (projectQuery.error || deliveryQuery.error) return <Redirect href="/accountant" />
  if (!delivery || !project) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <T size={14} lh={20 / 14} color={colors.inkMuted}>
            Loading…
          </T>
        </View>
        <ScreenHeader title="Review bill" onBack={back} />
      </Screen>
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
      deliveryQuery.refetch()
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
      back()
    } catch {
      setSaving(false)
    }
  }

  // Until the PO's ordered quantity is entered there's nothing to compare against.
  const comparable = orderedQty.trim() !== '' && quantity.trim() !== ''
  const tone = !comparable
    ? { text: colors.inkMuted, bg: 'rgba(255,255,255,0.8)' }
    : hasDiscrepancy
      ? { text: colors.warningText, bg: colors.warningBg }
      : { text: colors.successText, bg: colors.successBg }

  return (
    <Screen>
      <FrostScope>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FrostBackdrop style={{ flex: 1 }}>
            <PageBackground />
            <ScrollView
              contentContainerStyle={{ paddingTop: SCREEN_HEADER_HEIGHT + 8, paddingHorizontal: 20, paddingBottom: 16 + barHeight, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              <Card style={{ padding: 6 }}>
                <Tap onPress={() => delivery.photoUrl && setViewerOpen(true)} accessibilityLabel="View bill photo" style={styles.photo}>
                  {delivery.photoUrl ? (
                    // The photo is the backdrop the frosted "Tap to enlarge" pill blurs.
                    <FrostScope>
                      <FrostBackdrop style={StyleSheet.absoluteFill}>
                        <AuthImage src={delivery.photoUrl} />
                      </FrostBackdrop>
                      <View style={styles.enlarge}>
                        <Frost blur={8} tint="rgba(0, 0, 0, 0.45)" style={{ borderRadius: 999 }} />
                        <T size={12} weight={700} color={colors.white}>
                          Tap to enlarge
                        </T>
                      </View>
                    </FrostScope>
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                      <IconCamera size={32} stroke="#8D9A9E" />
                    </View>
                  )}
                </Tap>
                <View style={styles.photoMeta}>
                  <T size={11.5} color={colors.inkMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {delivery.uploadedBy ? `${delivery.uploadedBy} · ` : ''}
                    {formatDateTime(delivery.uploadedAt)}
                  </T>
                  {delivery.photoUrl ? (
                    delivery.driveFileId ? (
                      <Tap
                        onPress={() => delivery.driveWebViewLink && void Linking.openURL(delivery.driveWebViewLink)}
                        style={[styles.chip, { backgroundColor: colors.successBg }]}
                      >
                        <IconCheck size={13} stroke={colors.successText} strokeWidth={2.5} />
                        <T size={12} weight={700} color={colors.successText}>
                          In Drive ↗
                        </T>
                      </Tap>
                    ) : (
                      <Tap onPress={() => void saveToDrive()} disabled={savingToDrive} style={[styles.chip, { backgroundColor: colors.infoBg }, savingToDrive && { opacity: 0.6 }]}>
                        <IconCloud size={13} stroke={colors.accent} />
                        <T size={12} weight={700} color={colors.accent}>
                          {savingToDrive ? 'Saving…' : 'Save to Drive'}
                        </T>
                      </Tap>
                    )
                  ) : null}
                </View>
                {driveError ? (
                  <T size={12} weight={600} color={colors.warningText} style={{ paddingHorizontal: 10, paddingBottom: 6 }}>
                    {driveError}
                  </T>
                ) : null}
              </Card>

              <Card style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.toneIcon, { backgroundColor: tone.bg }]}>
                    {!comparable ? (
                      <IconClipboardCheck size={14} stroke={tone.text} />
                    ) : hasDiscrepancy ? (
                      <IconAlertTriangle size={14} stroke={tone.text} strokeWidth={2.5} />
                    ) : (
                      <IconCheck size={14} stroke={tone.text} strokeWidth={2.6} />
                    )}
                  </View>
                  <T size={14} weight={700} color={tone.text}>
                    {!comparable ? 'Enter both quantities to compare' : hasDiscrepancy ? 'Quantity mismatch' : 'Quantities match'}
                  </T>
                </View>
                <View style={styles.compare}>
                  {[
                    { label: 'Ordered', value: orderedQty.trim() ? String(ordered) : '—', color: colors.ink },
                    { label: 'Delivered', value: quantity.trim() ? String(delivered) : '—', color: colors.ink },
                    {
                      label: !comparable ? 'Difference' : diff > 0 ? 'Short by' : diff < 0 ? 'Extra' : 'Difference',
                      value: comparable ? String(Math.abs(diff)) : '—',
                      color: tone.text,
                    },
                  ].map((cell, i) => (
                    <View key={cell.label + i} style={[styles.compareCell, i > 0 && styles.compareDivider]}>
                      <T size={11} color={i === 2 ? tone.text : colors.inkMuted} style={{ textAlign: 'center' }}>
                        {cell.label}
                      </T>
                      <T size={20} weight={700} lh={1.25} color={cell.color} style={{ marginTop: 2, textAlign: 'center' }}>
                        {cell.value}
                      </T>
                    </View>
                  ))}
                </View>
              </Card>

              <View>
                <T size={12} weight={700} color={colors.inkMuted} style={styles.sectionLabel}>
                  Bill details
                </T>
                <View style={{ gap: 14 }}>
                  <Field label="Vendor" invalid={showErrors && !vendor.trim()} value={vendor} onChangeText={setVendor} />
                  <Field label="Item description" invalid={showErrors && !item.trim()} value={item} onChangeText={setItem} />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Field
                      style={{ flex: 1 }}
                      label="Ordered qty"
                      keyboardType="decimal-pad"
                      invalid={showErrors && !orderedQty.trim()}
                      value={orderedQty}
                      onChangeText={setOrderedQty}
                    />
                    <Field
                      style={{ flex: 1 }}
                      label={
                        <>
                          <T size={12} weight={600} color={colors.label}>
                            Delivered qty
                          </T>
                          {delivery.quantityLowConfidence ? (
                            <View style={styles.doubleCheck}>
                              <T size={9} weight={700} color={colors.warningText}>
                                DOUBLE-CHECK
                              </T>
                            </View>
                          ) : null}
                        </>
                      }
                      keyboardType="decimal-pad"
                      invalid={delivery.quantityLowConfidence || (showErrors && !quantity.trim())}
                      value={quantity}
                      onChangeText={setQuantity}
                    />
                  </View>
                  <Field label="PO number" invalid={showErrors && !poNumber.trim()} value={poNumber} onChangeText={setPoNumber} />
                  {/* The 6.4 px under it is the space a browser leaves under a textarea. */}
                  <View style={{ marginBottom: 6.4 }}>
                    <T size={12} weight={600} color={colors.label} style={{ marginBottom: 6, marginLeft: 12 }}>
                      Note (optional)
                    </T>
                    {/* Outline on a wrapper: changing it on the TextInput itself makes Android drop its padding. */}
                    <View style={[glassStrong, styles.noteFrame, noteFocused && styles.noteFocused]}>
                      <TextInput
                        multiline
                        numberOfLines={2}
                        placeholder="e.g. Short by 10 bags — vendor to send the remainder"
                        placeholderTextColor={colors.inkFaint}
                        value={note}
                        onChangeText={setNote}
                        onFocus={() => setNoteFocused(true)}
                        onBlur={() => setNoteFocused(false)}
                        underlineColorAndroid="transparent"
                        style={styles.note}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </FrostBackdrop>

          <ActionBar onHeight={setBarHeight}>
            {showErrors && missingFields.length > 0 ? (
              <T size={12} weight={600} color={colors.warningText} style={{ textAlign: 'center', paddingTop: 4 }}>
                Fill in {missingFields.join(', ')} before confirming a match.
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SecondaryButton onPress={() => void save('REVIEW')} disabled={saving} style={{ flex: 1, paddingVertical: 14 }}>
                <IconAlertTriangle size={15} stroke={colors.warningText} strokeWidth={2.4} />
                <T size={13.5} weight={600} color={colors.warningText}>
                  {delivery.status === 'REVIEW' ? 'Keep flagged' : 'Flag'}
                </T>
              </SecondaryButton>
              <PrimaryButton onPress={() => void save('MATCHED')} disabled={saving} style={{ flex: 1.4, paddingVertical: 14 }}>
                <IconCheck size={16} stroke={colors.white} strokeWidth={2.6} />
                <T size={14} weight={700} color={colors.white}>
                  {delivery.status === 'MATCHED' ? 'Save as matched' : 'Confirm match'}
                </T>
              </PrimaryButton>
            </View>
          </ActionBar>
        </KeyboardAvoidingView>

        <ScreenHeader
          title="Review bill"
          subtitle={`${project.code} · ${project.name}`}
          action={<StatusBadge status={delivery.status} />}
          onBack={back}
        />
      </FrostScope>
      {viewerOpen ? <PhotoViewer src={delivery.photoUrl} onClose={() => setViewerOpen(false)} /> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: colors.cameraBg, overflow: 'hidden' },
  enlarge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    borderRadius: 999,
    ...ring(1, 'rgba(255,255,255,0.3)'),
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  photoMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  toneIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  compare: {
    flexDirection: 'row',
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    ...ring(1, colors.white),
  },
  compareCell: { flex: 1, paddingVertical: 10 },
  compareDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.06)' },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10, marginLeft: 4 },
  doubleCheck: { backgroundColor: colors.warningBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  note: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Two rows of 13.5 px text, as the web's rows={2} textarea.
    minHeight: 2 * 20.25 + 24,
    lineHeight: 20.25,
    textAlignVertical: 'top',
    fontFamily: fonts[400],
    fontSize: 13.5,
    color: colors.ink,
  },
  noteFrame: { borderRadius: 16 },
  noteFocused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'rgba(26, 60, 94, 0.4)' },
})
