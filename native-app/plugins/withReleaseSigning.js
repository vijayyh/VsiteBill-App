// Signs release builds with the SiteVerify upload key (the same key as the existing Android app in
// ../android, so the production variant can install as an update over it).
//
// The key and its passwords never go in git. They're read from Gradle properties at build time,
// e.g. passed as environment variables:
//   ORG_GRADLE_PROJECT_SITEVERIFY_STORE_FILE=C:\Users\...\siteverify-release.jks
//   ORG_GRADLE_PROJECT_SITEVERIFY_STORE_PASSWORD=...
//   ORG_GRADLE_PROJECT_SITEVERIFY_KEY_ALIAS=siteverify
//   ORG_GRADLE_PROJECT_SITEVERIFY_KEY_PASSWORD=...
// Without them a release build falls back to the debug key (fine for trying it out, not for sharing).
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = 'SITEVERIFY_STORE_FILE'

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents
    if (gradle.includes(MARKER)) return cfg

    const signingConfigs = 'signingConfigs {'
    const releaseSigning = 'signingConfig signingConfigs.debug\n            def enableShrinkResources'
    if (!gradle.includes(signingConfigs) || !gradle.includes(releaseSigning)) {
      throw new Error('withReleaseSigning: android/app/build.gradle no longer has the expected layout')
    }

    gradle = gradle.replace(
      signingConfigs,
      `${signingConfigs}
        release {
            if (findProperty('${MARKER}')) {
                storeFile file(findProperty('${MARKER}'))
                storePassword findProperty('SITEVERIFY_STORE_PASSWORD')
                keyAlias findProperty('SITEVERIFY_KEY_ALIAS')
                keyPassword findProperty('SITEVERIFY_KEY_PASSWORD')
            }
        }`,
    )
    gradle = gradle.replace(
      releaseSigning,
      `signingConfig findProperty('${MARKER}') ? signingConfigs.release : signingConfigs.debug\n            def enableShrinkResources`,
    )
    cfg.modResults.contents = gradle
    return cfg
  })
}
