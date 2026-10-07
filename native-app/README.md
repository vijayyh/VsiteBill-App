# SiteVerify native app (React Native + Expo)

A real native mobile app for SiteVerify, built with **React Native** (Expo SDK 57, TypeScript, Expo
Router). It replaces the browser-based Android app in `../android` (a Trusted Web Activity that
opens the website in Chrome) with native screens, native navigation and native device features,
while looking and behaving like the website screen for screen.

It talks to the **same backend API** (`backend/`, live at `https://vsitebill-api.onrender.com`).
Nothing in the backend or the website changed for it.

> Status: built and verified screen by screen against the web app on an Android emulator; in the
> `main` branch since 2026-10-07. Not yet installed on a real phone.

## Two variants

| Variant | App name | App id | Use |
|---|---|---|---|
| beta (default) | SiteVerify Beta | `in.sustaniq.siteverify.beta` | Installs **next to** the current app, for side-by-side testing |
| production (`APP_VARIANT=production`) | SiteVerify | `in.sustaniq.siteverify` | Installs **over** the current Android app (same id, same signing key, higher versionCode 100) |

Version `2.0.0`, versionCode `100` (the browser-based app is at 1.0.1, code 2).

## What's where

| Path | What it is |
|---|---|
| `app.config.ts` | App name, id, icons, splash, permissions, variants. Native settings live here. |
| `src/app/` | Screens. Every file is a route (Expo Router): `index` (welcome), `login`, `forgot-password`, and one folder per role (`supervisor/`, `accountant/`, `admin/`), each with `(tabs)/` for the bottom-bar screens. |
| `src/components/` | Shared UI: buttons, fields, cards, headers, bottom bar, photo viewer, opening splash, frosted glass (`Frost.tsx`). |
| `src/screens/` | Screens shared by all roles (Alerts, Profile). |
| `src/lib/` | API client, login session, offline upload queue (SQLite + files), photo shrinking, alerts polling, theme (colours and styles copied from the web's `index.css`). |
| `assets/` | Icon, adaptive icon and splash images, generated from `../frontend/brand/*.svg` by `npm run assets`. |
| `plugins/withReleaseSigning.js` | Signs release builds with the SiteVerify key (see Signing). |
| `patches/` | A one-line fix to `expo-blur`, applied automatically on `npm install` (see Gotchas). |
| `android/` | **Generated** by `npx expo prebuild` from `app.config.ts`. Git-ignored; never edit by hand. |

Each screen file names the web screen it mirrors (e.g. `frontend/src/screens/admin/Users.tsx`).
When a web screen changes, change its native twin too.

## Running it (development)

Needs Node, the Android SDK and JDK 17 (on the home machine: `C:\Users\vijay\.jdks\jdk-17\...`),
and an emulator or a phone with USB debugging.

```bash
npm install
npx expo run:android
```

That builds and installs a **development build** (the SiteVerify Beta app with a dev menu) and
starts Metro, which serves the JavaScript and reloads it as you edit. Native changes (new native
packages, `app.config.ts`, `patches/`) need `npx expo run:android` again; JS changes don't.

To use the **local backend** instead of the live one (always do this when testing, so no test
data reaches production): start the backend, then
`EXPO_PUBLIC_API_BASE=http://10.0.2.2:5000 npx expo start` (10.0.2.2 is the PC as seen from the
Android emulator).

On Windows, run Gradle from PowerShell, not Git Bash (Git Bash breaks `gradlew.bat`).

Checks (run before committing): `npx tsc --noEmit` and `npx expo lint`.

## Building a release APK

1. `npx expo prebuild --platform android` (regenerates `android/` from `app.config.ts`; add
   `APP_VARIANT=production` for the production app).
2. **Copy the folder to a short path outside OneDrive** and build there. Inside OneDrive the C++
   step fails ("build.ninja still dirty after 100 tries": OneDrive touches the files mid-build).
   `robocopy <project>\native-app C:\sv\native-app /MIR /XD .cxx build .gradle` (the copy at
   `C:\sv\native-app` already exists on the home machine; re-run robocopy to update it).
3. Build there with the signing key supplied as Gradle properties. On the home PC (7 GB RAM), limit
   the workers or it runs out of memory ("Insufficient system resources"). Close other heavy apps
   and the emulator first. Takes about 20 minutes.

```powershell
$dir = 'C:\Users\vijay\SiteVerify-android-signing'
$env:ORG_GRADLE_PROJECT_SITEVERIFY_STORE_FILE = "$dir\siteverify-release.jks"
$env:ORG_GRADLE_PROJECT_SITEVERIFY_KEY_ALIAS = '<alias from PASSWORD.txt>'
$env:ORG_GRADLE_PROJECT_SITEVERIFY_STORE_PASSWORD = '<password from PASSWORD.txt>'
$env:ORG_GRADLE_PROJECT_SITEVERIFY_KEY_PASSWORD = '<password from PASSWORD.txt>'
cd C:\sv\native-app\android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64 --max-workers=2 -Pkotlin.compiler.execution.strategy=in-process -Porg.gradle.parallel=false
```

4. The APK is `android\app\build\outputs\apk\release\app-release.apk`. Copy it back as
   `native-app\SiteVerify-Beta-<version>.apk` (`*.apk` is git-ignored) and share it from there.
   Check the signature matches the current app with
   `apksigner verify --print-certs <apk>` (SHA-256 `b0811a73…ffea17c`).

Don't set `EXPO_PUBLIC_API_BASE` for a release build: it must use the live API.

| Version | Code | Variant | Notes |
|---|---|---|---|
| 2.0.0 | 100 | beta | First native build (2026-10-07), 94 MB, signed with the SiteVerify key |

## Signing

The same key as the browser-based app: `C:\Users\vijay\SiteVerify-android-signing\`
(`siteverify-release.jks` + `PASSWORD.txt`), outside the repo. **Never commit it.** Without the
four properties above, a release build falls back to the debug key, which is fine on the emulator
but can't update an installed app.

## Updates: an important difference from the browser-based app

The browser-based app shows the live website, so every website deploy reaches phones at once. This
app has its screens built in. **Any change to the app's screens needs a new APK** (with a higher
`versionCode`) installed on each phone. Backend changes still reach it at once. Expo's EAS Update
could push screen changes over the air later if that becomes a burden.

## Deliberate differences from the web app

Native equivalents, not changes in what the app does:

- **Native screens and transitions**: inner screens slide in; the Android back button steps back
  through screens and visited tabs, like the browser's back button.
- **Pull to refresh** on the list screens (there's no browser reload button), and screens refresh
  quietly when you come back to them.
- **Photo viewer**: pinch to zoom, double-tap to zoom, drag to pan.
- **Take a photo** opens the phone's own camera app; **Choose from gallery** opens the system photo
  picker. Photos are shrunk on the phone before upload, as on the web.
- **Dropdowns** (role, Shared Drive) open a native option sheet instead of Chrome's select dialog.
- **Profile** shows the app version (`Version 2.0.0`) instead of the website's build date.
- **Saved offline**: after "Send to office" with no signal, the app shows "Saved on this phone"
  even though it can't load the project name; the website goes back to Home in that case.
- **Frosted glass** is blurred on Android 12 and later; older phones get the same tint without the
  blur.

## Known gaps (same on the website)

- **Offline, screens can't load data they haven't loaded yet.** The project list and project pages
  are fetched live, so with no signal the supervisor can only capture a bill from a project screen
  that was already open. Queued bills do save and send themselves when the signal returns (checked).
  Fixing this means keeping the last project list on the phone, in both apps.
- After the signal returns, Home keeps the "Failed to fetch" message until refreshed (pull down).

## iPhone

The same code builds an iPhone app (`ios.bundleIdentifier` is set). Building it needs a Mac with
Xcode, or EAS Build (Expo's cloud build), plus an Apple Developer account ($99/year) to install it
on phones or publish it. Not built or tested yet.

## Gotchas

- **Expo SDK 57 ships native modules precompiled.** A patch to a module's native source only
  takes effect if that module is listed under `expo.autolinking.android.buildFromSource` in
  `package.json` (done for `expo-blur`).
- **`expo-blur` noise patch** (`patches/expo-blur+57.0.3.patch`): the blur library overlays a grainy
  noise texture by default; the web's blur has none, so it's turned off. Re-check the patch when
  upgrading Expo.
- **Expo's `fetch`** replaces React Native's. It sends a photo only as a file part that can read
  its own bytes (see `billForm` in `src/lib/offlineQueue.ts`); the old `{ uri, name, type }` shape
  alone silently fails, and every upload would sit in the offline queue.
- **Changing the focus outline on a `TextInput`** itself makes Android drop its padding, so fields
  draw their frame and outline on a wrapper view.
- **A web `ring` next to `shadow-*` or `glass` never shows** (Tailwind draws both with
  `box-shadow`, and the shadow wins), so the native app leaves those rings out too, on purpose.
- **Dev builds only:** after using the camera, the dev build often shows "Cannot connect to Expo
  CLI"; dismiss it. Release builds don't connect to Metro.
