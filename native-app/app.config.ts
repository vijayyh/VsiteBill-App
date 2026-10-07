import type { ExpoConfig } from 'expo/config'

// Two variants of the same app:
// - "beta" (default): installs as a separate app, "SiteVerify Beta", next to the current one, for
//   testing side by side.
// - "production" (APP_VARIANT=production): app id in.sustaniq.siteverify, the same as the current
//   Android app (android/), so it installs as an update over it when signed with the same key.
const production = process.env.APP_VARIANT === 'production'
const NAVY = '#1A3C5E'

const config: ExpoConfig = {
  name: production ? 'SiteVerify' : 'SiteVerify Beta',
  slug: 'siteverify',
  version: '2.0.0',
  orientation: 'portrait',
  scheme: 'siteverify',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  backgroundColor: '#F5F5F2',
  android: {
    package: production ? 'in.sustaniq.siteverify' : 'in.sustaniq.siteverify.beta',
    // Above the current Android app's versionCode (2), so the production variant can replace it.
    versionCode: 100,
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: NAVY,
    },
    softwareKeyboardLayoutMode: 'resize',
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: production ? 'in.sustaniq.siteverify' : 'in.sustaniq.siteverify.beta',
    supportsTablet: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: NAVY,
        image: './assets/splash-icon.png',
        imageWidth: 300,
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission: 'SiteVerify uses the camera to photograph delivery bills.',
        photosPermission: 'SiteVerify lets you choose a photo of a bill you have already taken.',
      },
    ],
    'expo-font',
    'expo-image',
    'expo-sqlite',
    'expo-secure-store',
    'expo-web-browser',
    // Release builds signed with the SiteVerify key, supplied at build time (see the plugin).
    './plugins/withReleaseSigning',
  ],
  experiments: {
    typedRoutes: true,
  },
}

export default config
