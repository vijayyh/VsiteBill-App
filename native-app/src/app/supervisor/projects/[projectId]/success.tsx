import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback } from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconCamera, IconCheck, IconClock } from '../../../../components/icons'
import { Screen } from '../../../../components/Screen'
import { T } from '../../../../components/T'
import { Card, PrimaryButton, SecondaryButton } from '../../../../components/ui'
import { useApiGet } from '../../../../lib/api'
import { colors, shadowSoft } from '../../../../lib/theme'
import type { Project } from '../../../../lib/types'

// Same as the web app's confirmation screen (frontend/src/screens/supervisor/UploadSuccess.tsx).
export default function UploadSuccess() {
  const { projectId = '', queued: queuedParam } = useLocalSearchParams<{ projectId: string; queued?: string }>()
  const queued = queuedParam === '1'
  const insets = useSafeAreaInsets()
  const { data, error } = useApiGet<{ project: Project }>(`/api/projects/${projectId}`)
  const projectPath = `/supervisor/projects/${projectId}` as const

  // Back from here goes to the project, not into the finished form.
  const toProject = useCallback(() => router.dismissTo(projectPath), [projectPath])
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        toProject()
        return true
      })
      return () => sub.remove()
    }, [toProject]),
  )

  if (error && !queued) return <Redirect href="/supervisor" />
  const project = data?.project
  const tone = queued ? { bg: colors.warningBg, fg: colors.warningText } : { bg: colors.successBg, fg: colors.successText }

  return (
    <Screen>
      <View style={styles.body}>
        <View style={[styles.bigIcon, { backgroundColor: tone.bg }]}>
          {queued ? <IconClock size={44} stroke={tone.fg} strokeWidth={2.4} /> : <IconCheck size={48} stroke={tone.fg} strokeWidth={2.6} />}
        </View>
        <T size={24} weight={700} lh={1.25} style={{ textAlign: 'center' }}>
          {queued ? 'Saved on this phone' : 'Bill sent to the office'}
        </T>
        <T size={13.5} lh={1.625} color={colors.inkMuted} style={styles.lead}>
          {queued
            ? `No signal right now. It will send to ${project?.code ?? 'the office'} by itself as soon as you're back online.`
            : 'The office team will check it against the purchase order. Nothing more needed from you.'}
        </T>

        <Card style={styles.summary}>
          <View style={[styles.smallIcon, { backgroundColor: tone.bg }]}>
            {queued ? <IconClock size={18} stroke={tone.fg} strokeWidth={2.4} /> : <IconCheck size={18} stroke={tone.fg} strokeWidth={2.6} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={13.5} weight={700} numberOfLines={1}>
              {project ? `${project.code} · ${project.name}` : '…'}
            </T>
            <T size={12} color={colors.inkMuted} style={{ marginTop: 2 }}>
              {queued
                ? 'Waiting for signal · keep the app open or come back later'
                : `Sent today, ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
            </T>
          </View>
        </Card>
      </View>

      <View style={[styles.actions, { paddingBottom: 32 + insets.bottom }]}>
        <PrimaryButton onPress={toProject} style={{ paddingVertical: 16 }}>
          <T size={15} weight={700} color={colors.white}>
            Back to project
          </T>
        </PrimaryButton>
        <SecondaryButton onPress={() => router.dismissTo(`${projectPath}/upload`)} style={{ paddingVertical: 14 }}>
          <IconCamera size={18} stroke={colors.ink} />
          <T size={14} weight={600}>
            Add another bill
          </T>
        </SecondaryButton>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 },
  bigIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadowSoft,
    marginBottom: 24,
  },
  lead: { marginTop: 8, marginBottom: 24, maxWidth: 300, textAlign: 'center' },
  summary: { width: '100%', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
})
