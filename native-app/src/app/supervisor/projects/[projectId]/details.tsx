import { Image } from 'expo-image'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { ActionBar, Frost, FrostBackdrop, FrostScope } from '../../../../components/Frost'
import { SCREEN_HEADER_HEIGHT, ScreenHeader } from '../../../../components/headers'
import { IconCamera } from '../../../../components/icons'
import { PageBackground, Screen } from '../../../../components/Screen'
import { T } from '../../../../components/T'
import { Card, Field, PrimaryButton, Tap } from '../../../../components/ui'
import { api, ApiError } from '../../../../lib/api'
import { compressImage } from '../../../../lib/compressImage'
import { billForm, isOnline, queueUpload } from '../../../../lib/offlineQueue'
import { colors, ring } from '../../../../lib/theme'

// Same as the web app's bill details form (frontend/src/screens/supervisor/DeliveryDetails.tsx):
// with no signal (or if sending fails on the way), the bill is saved on the phone and sent later.
export default function DeliveryDetails() {
  const params = useLocalSearchParams<{ projectId: string; uri: string; width: string; height: string; fileName: string }>()
  const projectId = params.projectId ?? ''
  const [vendor, setVendor] = useState('')
  const [item, setItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [barHeight, setBarHeight] = useState(0)

  if (!params.uri) return <Redirect href={`/supervisor/projects/${projectId}/upload`} />

  const missingFields: string[] = []
  if (!vendor.trim()) missingFields.push('vendor')
  if (!item.trim()) missingFields.push('item description')
  if (!quantity.trim()) missingFields.push('quantity delivered')

  const successPath = `/supervisor/projects/${projectId}/success` as const

  async function handleSubmit() {
    if (missingFields.length > 0) {
      setShowErrors(true)
      return
    }
    setUploading(true)
    setError(null)
    const details = { vendor, item, delivered: quantity, poNumber }
    const photo = await compressImage({
      uri: params.uri!,
      width: Number(params.width) || 0,
      height: Number(params.height) || 0,
      fileName: params.fileName || null,
    })

    if (!(await isOnline())) {
      await queueUpload(projectId, photo.uri, photo.filename, details)
      router.replace({ pathname: '/supervisor/projects/[projectId]/success', params: { projectId, queued: '1' } })
      return
    }

    try {
      await api.post(`/api/projects/${projectId}/deliveries`, billForm(photo.uri, photo.filename, details))
      router.replace(successPath)
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Could not upload that photo. Try again.')
        setUploading(false)
        return
      }
      await queueUpload(projectId, photo.uri, photo.filename, details)
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
              contentContainerStyle={{ paddingTop: SCREEN_HEADER_HEIGHT + 8, paddingHorizontal: 20, paddingBottom: 16 + barHeight, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
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

              <T size={12.5} lh={1.625} color={colors.inkMuted} style={{ paddingHorizontal: 4 }}>
                Copy these from the bill. The office team will check them against the purchase order.
              </T>

              <View style={{ gap: 14 }}>
                <Field label="Vendor" placeholder="e.g. UltraTech Cement Ltd" invalid={showErrors && !vendor.trim()} value={vendor} onChangeText={setVendor} />
                <Field
                  label="Item description"
                  placeholder="e.g. OPC 53 Grade Cement, 50kg bags"
                  invalid={showErrors && !item.trim()}
                  value={item}
                  onChangeText={setItem}
                />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Field
                    style={{ flex: 1 }}
                    label="Quantity delivered"
                    keyboardType="decimal-pad"
                    placeholder="e.g. 480"
                    invalid={showErrors && !quantity.trim()}
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                  <Field style={{ flex: 1 }} label="PO number" placeholder="If known" value={poNumber} onChangeText={setPoNumber} />
                </View>
              </View>
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
