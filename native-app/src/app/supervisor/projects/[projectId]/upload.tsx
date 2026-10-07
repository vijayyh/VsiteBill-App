import * as ImagePicker from 'expo-image-picker'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconCamera, IconChevronRight, IconGallery } from '../../../../components/icons'
import { Frost, FrostBackdrop, FrostScope } from '../../../../components/Frost'
import { ProjectHero } from '../../../../components/projects'
import { PageBackground, Screen } from '../../../../components/Screen'
import { T } from '../../../../components/T'
import { Tap } from '../../../../components/ui'
import { useApiGet } from '../../../../lib/api'
import { colors, glass, glassStrong, navyGradient, radii, ring } from '../../../../lib/theme'
import type { Project } from '../../../../lib/types'

// Same as the web app's "Add a bill" sheet (frontend/src/screens/supervisor/UploadOptions.tsx).
// "Take a photo" opens the phone's own camera app; "Choose from gallery" the system photo picker.
export default function UploadOptions() {
  const { projectId = '' } = useLocalSearchParams<{ projectId: string }>()
  const insets = useSafeAreaInsets()
  const { data, error } = useApiGet<{ project: Project }>(`/api/projects/${projectId}`)
  const [problem, setProblem] = useState<string | null>(null)

  if (error) return <Redirect href="/supervisor" />
  const project = data?.project
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/supervisor/projects/${projectId}`))

  function openDetails(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    router.push({
      pathname: '/supervisor/projects/[projectId]/details',
      params: {
        projectId,
        uri: asset.uri,
        width: String(asset.width),
        height: String(asset.height),
        fileName: asset.fileName ?? '',
      },
    })
  }

  async function takePhoto() {
    setProblem(null)
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      setProblem('Camera access is off. Allow it in the phone’s settings to photograph bills.')
      return
    }
    openDetails(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }))
  }

  async function choosePhoto() {
    setProblem(null)
    openDetails(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }))
  }

  return (
    <Screen>
      {/* The project screen, dimmed and slightly blurred behind the sheet. */}
      <FrostScope>
        <FrostBackdrop style={{ flex: 1 }}>
          <PageBackground />
          <View pointerEvents="none">
            <ProjectHero onBack={close} code={project?.code} name={project?.name} accent={project?.accent} />
          </View>
        </FrostBackdrop>
        <Pressable onPress={close} accessibilityLabel="Cancel" style={StyleSheet.absoluteFill}>
          <Frost blur={3} tint="rgba(30, 35, 32, 0.35)" />
        </Pressable>
      </FrostScope>

      <View style={[styles.sheetWrap, { paddingBottom: 12 + insets.bottom }]}>
        <View style={[glassStrong, styles.sheet]}>
          <View style={styles.handle} />
          <T size={18} weight={700}>
            Add a bill
          </T>
          <T size={12.5} color={colors.inkMuted} style={{ marginTop: 4, marginBottom: 20 }}>
            Photograph the bill{project ? ` for ${project.code}` : ''}{", or pick a photo you've already taken."}
          </T>

          <View style={{ gap: 10 }}>
            <Tap onPress={() => void takePhoto()} style={styles.camera}>
              <View style={styles.cameraIcon}>
                <IconCamera size={22} stroke={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <T size={15} weight={700} color={colors.white}>
                  Take a photo
                </T>
                <T size={12} color="rgba(255,255,255,0.8)" style={{ marginTop: 1 }}>
                  {"Opens the phone's camera"}
                </T>
              </View>
              <IconChevronRight size={18} stroke={colors.white} />
            </Tap>

            <Tap onPress={() => void choosePhoto()} style={[glass, styles.gallery]}>
              <View style={styles.galleryIcon}>
                <IconGallery size={21} stroke={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <T size={15} weight={700}>
                  Choose from gallery
                </T>
                <T size={12} color={colors.inkMuted} style={{ marginTop: 1 }}>
                  Use a photo already on this phone
                </T>
              </View>
              <IconChevronRight size={18} stroke={colors.inkFaint} />
            </Tap>
          </View>

          {problem ? (
            <T size={12.5} weight={600} color={colors.warningText} style={{ marginTop: 12, textAlign: 'center' }}>
              {problem}
            </T>
          ) : null}

          <Tap onPress={close} style={{ marginTop: 12, paddingVertical: 12, alignItems: 'center' }}>
            <T size={14} weight={600} color={colors.inkMuted}>
              Cancel
            </T>
          </Tap>
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  sheet: { borderRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(30, 35, 32, 0.15)', alignSelf: 'center', marginBottom: 20 },
  camera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radii.card,
    experimental_backgroundImage: navyGradient,
    boxShadow: '0px 12px 24px -14px rgba(26, 60, 94, 0.9)',
  },
  cameraIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    ...ring(1, 'rgba(255,255,255,0.4)'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallery: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radii.card },
  galleryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
    ...ring(1, colors.white),
    alignItems: 'center',
    justifyContent: 'center',
  },
})
