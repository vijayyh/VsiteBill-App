import {
  IBMPlexSans_400Regular,
  IBMPlexSans_400Regular_Italic,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBand } from '../components/Screen'
import { SplashIntro } from '../components/SplashIntro'
import { useAutoFlushOfflineQueue } from '../lib/offlineQueue'
import { SessionProvider, useSession } from '../lib/session'
import { wakeOnResume } from '../lib/splash'
import { colors } from '../lib/theme'

// Keep the native splash up until the fonts and the saved login are loaded; the animated intro
// (SplashIntro) then takes over from it seamlessly and hides it.
void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_400Regular_Italic,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  })
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <App fontsLoaded={fontsLoaded} />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function App({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready } = useSession()
  useAutoFlushOfflineQueue()
  useEffect(() => wakeOnResume(), [])

  const [intro, setIntro] = useState(true)
  const introDone = useCallback(() => setIntro(false), [])

  if (!(fontsLoaded && ready)) return null
  return (
    <View style={{ flex: 1, backgroundColor: colors.pageTop }}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      <StatusBand />
      {intro ? <SplashIntro onDone={introDone} /> : null}
      <StatusBar style="light" />
    </View>
  )
}
