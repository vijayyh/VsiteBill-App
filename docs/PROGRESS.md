# SiteVerify — Progress log

The running record of what's been done and what's next, so work can continue on either machine
(office or home). **Update this at the end of every working session, then commit and push.**

---

## Where we left off

_Last updated: 2026-10-09, end of session (home machine; the user continues at the office)_

**State:** everything is in `main` and pushed. The web app is live and unchanged since 2026-10-05.
The new **native mobile app** (React Native + Expo) was merged into `main` on 2026-10-07, in its
own top-level `native-app/` folder; nothing outside that folder changed except docs. It is not
installed on a real phone yet.
- Roadmap steps 1 (migrations), 2 (photo storage), 5 (tests), 6 (CI/CD) and 9 (scaling) are done.
  Steps 3, 4, 7 and 8 were skipped for now.
- The browser-based Android app (`android/`, v1.0.1) is still the one on phones. It shows the live
  site, so web deploys reach it automatically. **iPhone:** Safari → Add to Home Screen; not yet
  checked on a real iPhone.
- **Native app:** every screen of all three roles is built and was checked side by side against
  the web app on the emulator (local backend, test data deleted afterwards): layout within 1–2 dp,
  frosted glass, camera, gallery, offline queue and auto-send, review match/flag, alerts, admin
  users/projects/password resets. Typecheck and lint are clean. A signed release APK is built:
  `native-app/SiteVerify-Beta-2.0.0.apk` (git-ignored). See `native-app/README.md` and the
  2026-10-06/07 session log.

**Next step:**
1. **Before 2026-10-19: upgrade the Render Postgres** (open item 2), or the real data is deleted.
2. **Try the native app on a real phone:** install `native-app/SiteVerify-Beta-2.0.0.apk`. It
   installs next to the current app and uses the live server. Compare the two; if it's good, build
   the production variant so it replaces the current app.
3. Decide on the offline gap both apps share (open item 10).
4. **Back up the Android signing key folder** (open item 9). Without it the app can never be
   updated.
5. Decide on the free-plan sleep (open item 5), then deal with the security items 1 and 3.
6. **iPhone (open item 11):** for now iPhone users add the website to their home screen. The
   native iPhone app waits on the user getting an Apple Developer account.
7. Later: OCR (open item 6 has the agreed plan), roadmap steps 3, 4, 7 and 8.

**Not in git, so not on the other machine:** the APK files (`native-app/SiteVerify-Beta-2.0.0.apk`
and `android/*.apk`, home machine only), the signing key folder (open item 9), `backend/.env`
and the local `backend/siteverify.db` (each machine has its own), `node_modules` and the backend
`.venv` (reinstall per machine), and the release-build copy at `C:\sv\native-app` (home only).

**Home machine setup (done 2026-10-05):** the project is the `Sustaniq Vsite App` folder on the
OneDrive Desktop. Python 3.14.7, backend venv, `npm install`, local SQLite migrated.
`backend/.env` has empty values (copied from the template), so Google Drive doesn't work locally
on this machine until the `GOOGLE_*` values are filled in from Render. Git identity is set for
this repo only. Native app tooling (added 2026-10-05/06): JDK 17 in `C:\Users\vijay\.jdks\`, the
Android SDK with NDK 27, and the emulator `SiteVerify_Pixel` (Android 15).

### Open items (most urgent first)

1. **Security: demo admin password is public.** The GitHub repo is public and
   `backend/siteverify/seed.py` contains the demo accounts' phone numbers and password. Production
   was seeded with those accounts on 2026-10-02, so anyone reading the repo can log in to the live
   admin panel. Fix: change the production admin's password, and/or make the repo private (GitHub →
   Settings → General → Danger Zone → Change visibility).
2. **Render Postgres (`vsitebill-db`) is on the free tier and will be deleted on 2026-10-19** unless
   it's upgraded to a paid plan. It now holds the real data.
3. **Rotate the Supabase S3 access key.** It was pasted into a chat. Create a new key in Supabase
   (Project Settings → Storage → S3 access keys), update it on Render and in `backend/.env`, then
   delete the old one.
4. ~~Reconnect Google Drive on production~~: done. It's connected to `vijay@sustaniq.in` (My
   Drive), with folders for all 3 projects (checked 2026-10-03).
4b. ~~After a deploy, people keep seeing the old version until they reload once more~~: fixed
   2026-10-03 with an "A new version of SiteVerify is ready — Update" banner (see session log).
5. The `vsitebill-api` web service is on Render's **free plan**: it sleeps after 15 min idle, so the
   first login/send/match after a quiet spell is slow. Undecided options: (a) a paid instance,
   which never sleeps (the proper fix before real use); (b) a free uptime pinger hitting
   `/api/health` every 5 min, which keeps it awake within the 750 free hours/month; (c) the app
   pings the server as soon as it opens and shows "Starting up…" instead of a frozen button.
6. **OCR (planned for later, decided 2026-10-05).** Goal: when a supervisor photographs a bill, the
   vendor / item / quantity / PO fields fill themselves in. Plan:
   - Run OCR **on the server** behind a swappable `extract(photo)` function (e.g.
     `OCR_PROVIDER=google|custom`), with a new endpoint the bill form calls. The app and APK don't
     change when the provider changes.
   - Start with **Google Cloud Vision**. Later the user wants to **train their own OCR model**.
   - From day one, store what the OCR read next to what the accountant finally confirmed. Every
     matched bill becomes a labelled training example. Switch providers once the own model matches
     Google on past bills.
   - With no signal, OCR can't run on the server: the supervisor types the fields as today, or the
     server fills them once the queued bill sends. Existing hooks: `quantityLowConfidence` and the
     review screen's DOUBLE-CHECK badge.
   - An own model needs a bigger server than Render's free plan (likely a separate service).
7. ~~Bill photos are 5–7 MB each~~: fixed in step 9 (photos are now shrunk on the phone before
   upload). The 3 bills uploaded before that are still full size.
8. Tidy-up (Supabase storage is now confirmed working on production): `render.yaml` still declares the old
   `delivery-uploads` disk, which is no longer needed.
9. **Back up the Android signing key.** `C:\Users\vijay\SiteVerify-android-signing\` (home machine)
   holds `siteverify-release.jks` and `PASSWORD.txt`. It's not in git by design. Copy it somewhere
   safe (a USB drive or a password manager). To build the app at the office, copy it there
   securely too. The native app's release builds use the same key (see `native-app/README.md`).
10. **Offline: screens can't load data they haven't loaded yet (web app and native app alike).**
   The project list and project pages are fetched live and not kept on the device. With no
   signal, a supervisor can only capture a bill from a project screen that was already open:
   opening "Add bill" or a project shows "Failed to fetch" (the web then bounces to Home). Queued
   bills do save and send themselves when the signal returns (checked on the emulator in airplane
   mode). Fix, in both apps: keep the last project list on the device and use it when offline.
   Waiting on the user's go-ahead, since it changes behaviour.
11. **iPhone.** An APK only installs on Android, and iPhones can't install apps from a shared file.
   Today: iPhone users open the website in Safari → Share → Add to Home Screen (not yet checked on
   a real iPhone). Native iPhone app, when wanted: the same `native-app/` code, plus an Apple
   Developer account ($99/year), built with a Mac or Expo's cloud build (EAS Build, works from
   Windows), and handed out through TestFlight (invite by email; best start for a company team),
   an unlisted App Store listing, or Apple Business Manager. It needs iPhone-specific work and
   testing first, e.g. the frosted glass is tuned for Android (`intensity={1}` in
   `src/components/Frost.tsx` would show almost no blur on iPhone). Waiting on the user's decision
   (discussed 2026-10-07).

---

## Production-readiness roadmap

From the "SiteVerify — Complete Technical Guide & Production Roadmap" doc
(https://claude.ai/code/artifact/b63f0fa5-c550-4459-85e0-6646b4a24850).

| # | Step | Status |
|---|------|--------|
| 1 | Database: real migrations (Flask-Migrate/Alembic), Postgres in production | ✅ Done 2026-10-02 |
| 2 | File storage: bill photos in S3-compatible object storage (Supabase) | ✅ Done 2026-10-02 |
| 3 | Secrets management review | Skipped for now |
| 4 | Auth hardening: rate-limit login, short-lived tokens + refresh, lock down CORS | Skipped for now |
| 5 | Automated tests (pytest) | ✅ Done 2026-10-03 |
| 6 | CI/CD: GitHub Actions runs tests before deploy | ✅ Done 2026-10-03 (Render setting: see log) |
| 7 | Monitoring: Sentry, structured logs, uptime checks | Skipped for now |
| 8 | OCR on bill photos | Skipped for now (provider undecided) |
| 9 | Scaling | ✅ Done 2026-10-03 (see log) |

---

## Session log

Newest first. Each entry: what changed, what was verified, anything left half-done.

### 2026-10-07/09 — Native app merged into `main`; iPhone options (home)

- At the user's request, `native-app` was fast-forwarded into `main` (`e4a2c9b`, docs `616af02`).
  Checked first: nothing in `frontend/`, `backend/` or `android/` changed (only `native-app/` and
  docs), 87 backend tests pass, frontend lint and build pass, and the GitHub CI run on `main`
  passed. The live site and the browser-based app are unaffected; Render didn't redeploy.
- The user asked about iPhones: the APK is Android-only. Options written up as open item 11.
- Session ended here; the user continues on the office machine.

### 2026-10-06/07 — Native mobile app (React Native + Expo), branch `native-app` (home)

The user asked for a real native app instead of the browser-based APK, with the UI exactly like
the web app, on a separate branch and in its own folder. Built with React Native 0.86 + Expo SDK
57 (TypeScript, Expo Router), the stack big companies use for cross-platform apps. Everything is
in `native-app/` (see its README); the backend and website are untouched.

- **Variants:** "SiteVerify Beta" (`in.sustaniq.siteverify.beta`, the default) installs next to
  the current app for side-by-side testing; `APP_VARIANT=production` gives `in.sustaniq.siteverify`
  with versionCode 100, which will install over the current app (same signing key).
- **All screens built**, each mirroring its web file: welcome, login, forgot password; supervisor
  home, my bills, add bill, project page, upload sheet, bill details, sent/saved; accountant home,
  projects, review queue, gallery, bill review; admin overview (Drive, counts, password resets),
  users, projects, bills; alerts and profile for every role; the animated opening splash (same
  timing and server wake-up as the web).
- **Native features:** the phone's own camera and photo picker, photo shrinking before upload,
  offline queue in SQLite with automatic sending (on start, on reconnect, when the app comes back,
  every 20 s), pinch/double-tap zoom on photos, pull to refresh, native screen transitions, Android
  back button through screens and tabs, frosted glass blur (Android 12+).
- **Checked side by side** with the web app (Chrome at 411 px vs the emulator, 411 dp wide),
  measuring element positions: every screen within 1–2 dp. Fixes made while checking:
  - Uploads never reached the server: Expo's `fetch` silently failed on the photo part, so every
    bill sat in the offline queue. Fixed (`billForm`), then checked online and offline.
  - Form fields lost their padding when the focus or "missing" outline appeared (an Android quirk),
    so the frame and outline moved to a wrapper view.
  - Web `ring` styles drawn as outside outlines; rings the web never actually shows (next to a
    shadow or glass) left out.
  - Exact web line heights for `text-sm`/`text-xs` texts; the admin forms' compact field style;
    two-row note boxes; Cancel/Save sizing; project card width; welcome picture size; login and
    header positions; skyline opacity; photo viewer layout.
  - Frosted glass with real blur (`expo-blur`) on the bottom bar, inner headers, the form action
    bars (the form now scrolls under them, as on the web), project header pills and counts, photo
    pills and the dimmed overlay behind "Add a bill". Its default noise texture is patched off
    (`patches/`), and the radius corrected for the library's 4× scale; compared with the web at
    the same scale.
  - Option sheets (role, Shared Drive) made solid; network errors show the web's "Failed to fetch"
    instead of a Java exception; admin forms focus an empty required field like the web's
    `required` instead of dimming the button.
- **Flows verified on the emulator** against the local backend (photo bucket switched off): camera
  → details → send (online, and in airplane mode → "Saved on this phone" → sent by itself 6 s
  after reconnecting); accountant match, flag with note, alerts open the bill and mark it read;
  supervisor gets matched/flagged alerts; forgot password → admin sets a new password; admin
  creates a user (role picker), edits a project; login error message. The database backup was
  restored and the test photos deleted afterwards (3 users, 3 projects, 0 bills).
- **Found, not changed (same on the website):** offline, the app can't load screens it hasn't
  loaded yet (open item 10).
- **Release APK built (2026-10-07):** `native-app/SiteVerify-Beta-2.0.0.apk` (git-ignored, 94 MB,
  version 2.0.0 / code 100), signed with the existing key: `plugins/withReleaseSigning.js` reads it
  from Gradle properties at build time, never from git. The signature matches the current app's
  (same SHA-256). Two failed attempts first: inside the OneDrive folder the C++ step fails
  ("build.ninja still dirty"), and with default settings the 7 GB PC runs out of memory. Building
  from a copy at `C:\sv\native-app` with 2 workers works (recipe in the README, ~20 min).
- **Release APK checked on the emulator:** installs, opens with no crash; a screen recording of a
  cold start shows native splash → the animated intro → Welcome. Not logged in (it uses the live
  server, so no test data was created there).
- Merged into `main` on 2026-10-07 (fast-forward, at the user's request, after the checks above).
  Before pushing: 87 backend tests pass, frontend lint and build pass, and nothing in `frontend/`,
  `backend/` or `android/` changed, so the live site and Render are unaffected (each Render service
  only redeploys when its own folder changes).

### 2026-10-05 — New app icon and animated opening splash; Android app v1.0.1 (home)

- **Logo:** the user picked "Minimal document" out of three directions: a white document with a
  folded corner, a navy header line and a bold green check, on a navy tile whose glow fades to
  exactly `#1A3C5E` at the edges. Master SVGs are in `frontend/brand/` (`icon.svg` rounded,
  `icon-maskable.svg` full-bleed). `npm run icons` (sharp, dev dependency) regenerates
  `pwa-192/512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png` (zoomed for iOS),
  `favicon.svg`, and plain-navy iPhone launch images (`public/splash/`, kept out of the offline
  cache). The login header uses the new logo.
- **Opening splash** (`frontend/index.html` + `src/lib/splash.ts`), once per session:
  - The first frame is plain HTML/CSS and identical to the Android native splash (`pwa-512.png` at
    300 px on navy), so the native-to-web handover shows no change of picture. (The web copy sits
    ~14 px lower on the test emulator: Android centres on the whole screen, the page below the
    status bar. The native fade was lengthened to 500 ms to blend it.)
  - The intro (CSS) starts once the app has rendered underneath (`playSplash()` in an `App`
    effect), held until the Android native splash has finished fading. It first started at first
    paint, but on a cold start the phone is busy loading the app then, and the animation froze for
    ~2 s and jumped to its end (seen in emulator frame captures). The tile fades into a soft aura,
    the document lifts, a light sweeps across it, the check is "stamped" with a ripple,
    "SiteVerify" rises in letter by letter (Verify in green), then the tagline and
    "KH Group · Sustaniq".
  - Server wake-up: `/api/health` is pinged immediately. The splash waits for it up to 5 s total
    (user's choice), showing "Waking up the server…" after 2.4 s, then opens the app anyway.
    Offline: no wait, shows "No signal — you can still add bills". The server is pinged again when
    the app comes back after 10+ min. Login shows a "server is waking up" note after 5 s.
  - Measured (emulator Chrome): awake → app at ~1.9 s after the animation starts; asleep → hint at
    2.4 s, app at 5.0 s; offline → 2.8 s; reload in the same session → no splash. Production
    build: animation starts ~0.5 s after opening.
- **Android v1.0.1** (code 2): new launcher icon and native splash (from the live icons via
  `bubblewrap update`), navy `backgroundColor`, 500 ms native fade. Installed as an update over
  v1.0.0 on the emulator (same signing key), and the cold launch was checked frame by frame: home
  icon → native navy splash → identical web frame → animation → app.
- Commits: `db3d1cc` (icons + splash), `2d4feef` (docs), `369bb41` (intro after first render),
  then the regenerated `android/` project.

### 2026-10-05 — Android app (APK) and iPhone home-screen support (home)

- Approach: a Trusted Web Activity (Google's Bubblewrap), not a rewrite. The APK opens
  `vsitebill-app.onrender.com` full-screen in Chrome, so logic, UI and backend are exactly the web
  app's, and every deploy reaches the app with no reinstall. Capacitor was rejected because it
  would need a new APK per UI change and breaks Google sign-in for the Drive connect.
- Website changes (`87a76f8`): `.well-known/assetlinks.json` (verified by Google's Digital Asset
  Links API); manifest `start_url` `/login` → `/` (installed users were shown the login screen
  every launch); iPhone: opaque `default` status bar (white text on the light app was unreadable),
  `viewport-fit=cover`, and bottom padding for the home indicator via `--safe-bottom`.
- `android/`: `twa-manifest.json` + generated Gradle project. App id `in.sustaniq.siteverify`,
  v1.0.0 (code 1), portrait, starts at `/`. Signing key kept outside the repo in
  `C:\Users\vijay\SiteVerify-android-signing\` (password in `PASSWORD.txt` there). APK/AAB and keys
  are git-ignored.
- This machine now has Android cmdline-tools (also copied to `<sdk>/tools` for Bubblewrap),
  build-tools 36.1.0, and an emulator `SiteVerify_Pixel` (Android 15, Google Play image).
- Verified on the emulator against the live site, creating no data: full-screen with no address
  bar, navy status bar; login (took ~60 s because the free Render API was asleep); Add bill sheet;
  "Take a photo" opens the phone's own camera app and the photo comes back into the bill form;
  the empty-form check blocks sending; Android back steps back through screens; relaunch goes
  straight to the logged-in home; the offline cache controls the app from the second launch.
- Not checked: a real iPhone (no Mac or iPhone here), and opening the Android app in airplane
  mode (the offline cache is in place; the website build was checked offline earlier).
- First-launch notes for real phones: Android asks once to allow Chrome to use the camera; a
  phone that has never opened Chrome shows Chrome's welcome screen once.
- Structure: at the user's request the mobile app is kept separate from the web app. Everything
  is in the top-level `android/` folder with its own `android/README.md`; the main README only
  points to it (`3ff2e2b`, `dddd70b`). The only Android-related file outside it is
  `frontend/public/.well-known/assetlinks.json`, which the website has to serve.
- Discussed and agreed the OCR plan for later (see open item 6).

### 2026-10-05 — Full test pass, redesign merged, permission and admin fixes (home)

- Tested everything on the redesign branch: the 74 backend tests, a script calling all 34 API
  endpoints as anonymous / supervisor / accountant / admin, and a click-through of every screen and
  button for all three roles (including offline send and the production build opening offline).
  Test records were removed afterwards by restoring a database backup.
- **Merged `ui-redesign` into `main`** (`ea02c99`). CI passed; the live bundle has the new screens
  and the API has the notifications endpoint (migration `d0dc350e48df` ran on production).
- Fixes found by the test pass (all were also on the live site before):
  1. Supervisors could edit, flag or match any bill through the API. `PATCH /api/deliveries/<id>`
     is now accountant/admin only.
  2. Supervisors could read other supervisors' bills (`GET /api/deliveries/<id>`, and the project
     bill list without `?uploadedByMe=1`). Now they only ever see their own (404 otherwise).
  3. `save-to-drive` is now accountant/admin only.
  4. Admin "Set new password" on a reset request: the new password disappeared immediately (the
     request left the pending list), so it could never be relayed. It now stays until "Done".
  5. Non-numeric or negative ordered/delivered in a review caused a 500. Now a 400, and a bad
     request changes nothing.
  6. New admin buttons: "Reset password" per user (confirm step; not on your own account), and
     "Edit" per project (name and colour; the code can't change).
  - Small: Back from a bill opened via an alert returns to Alerts; the waiting-for-signal card puts
    its status on its own line so long vendor names aren't cut off; admin form inputs show a focus
    outline; Users says "bills" instead of "uploads".
  - 12 new tests in `backend/tests/test_bill_permissions.py` (86 total).
- The API's root address (`localhost:5000/`, which the backend preview opens, and
  `vsitebill-api.onrender.com`) showed Flask's bare "Not Found". It now shows "SiteVerify API is
  running" with a button to the app (`FRONTEND_URL`). Test added (87 total).
- This machine: git identity set for this repo only (`vijay hanumandla`), matching office commits.

### 2026-10-05 — UI redesign: remaining screens restyled (home, branch `ui-redesign`)

- Home machine set up: Python 3.14.7 (winget), backend venv, `npm install`, local SQLite via
  `flask db upgrade`. `backend/.env` was copied from the template with empty values, so Google Drive
  doesn't work locally until the `GOOGLE_*` values are filled in from Render.
- New `components/ProjectHero.tsx`: the colour project header (back button, code/name, Drive pill,
  a frosted strip of counts). Used by the supervisor Project screen (sent today / waiting / flagged)
  and the accountant ProjectGallery (pending / flagged / matched). The project gradients moved to
  `lib/projectColors.ts`.
- Restyled supervisor Project (glass cards, `FilterTabs`, empty states), the camera/gallery choice
  sheet (frosted bottom sheet over the dimmed project), the bill details form (shared `Field`,
  Retake button on the photo, sticky send bar) and the success screen; accountant ReviewDelivery
  (large photo, Drive chip, comparison card, sticky Flag / Confirm match bar); ForgotPassword.
- Fixes found along the way:
  - `Field` error and focus outlines never showed: the glass box-shadow cancelled Tailwind's `ring`.
    Now uses `outline`, which also fixes the Profile change-password form.
  - ReviewDelivery ignored the `from` state that Home and the Review queue pass, so back and save
    always went to the project gallery. Now they return to where the bill was opened from.
  - The comparison card said "Quantity mismatch / Extra 300" before any ordered quantity was
    entered. It now shows a neutral "Enter both quantities to compare".
  - Wording: "Deliveries logged" → "Bills logged" (admin), "challan" → "bill" (Add bill).
- Verified in the preview at phone size with temporary test bills, then deleted them (rows, alerts,
  photos): supervisor add-bill flow end to end, including validation; accountant flag/match
  returning to the right screen; every tab for all three roles. Lint (no errors) and build pass.

### 2026-10-03 — "New version ready" banner

- Problem (seen on the live site): the offline cache (service worker, `autoUpdate`) installs a new
  deploy in the background and takes over, but the open page keeps running the old code until it's
  reloaded again.
- `frontend/src/components/UpdateBanner.tsx`, shown at the top of every screen via `PhoneShell`:
  when a new version replaces the one the page started with, it shows "A new version of SiteVerify
  is ready" with **Update** (reloads) and **×** (dismiss). It doesn't reload automatically, so a
  half-filled bill isn't lost. It also checks for new versions when the app returns to the
  foreground and every 30 min, because an app left open never navigates and the browser wouldn't
  look otherwise. The service-worker setup is unchanged, so people already using the app don't get
  stuck on an old version.
- Verified with a real production build (new `siteverify-frontend-build` preview in
  `.claude/launch.json`, serving `vite preview` on :4173):
  - First visit: no banner.
  - Built a "version B" while the page stayed open: the foreground check showed the banner, with
    the page still on version A.
  - Tapping Update loaded version B and the banner went away. The test change was reverted.
- Live (`e1588cb`): CI passed and the live bundle contains the banner. A browser tab already open
  on the previous version needed two reloads to pick it up: the first lets the browser find the new
  version, the second runs it. From now on, every deploy shows the banner instead.

### 2026-10-03 — Accountants get view-only Google Drive access

- New `GET /api/office/drive` (accountant + admin only) returns whether Drive is connected, the
  account / Shared Drive name, and the root and per-project folder links. The refresh token is
  never included. Connect, disconnect and Shared-Drive switching stay admin-only.
  `require_role()` now accepts several roles.
- Accountant dashboard: a "Bills archive in Google Drive" card with an **Open ↗** link, or a
  "not connected yet" note. Each project gallery header has a **Drive ↗** link to that project's
  folder. Admin's Drive card reminds them to give accountants Viewer access.
- Opening the links also needs **Google-side permission**: the accountant's Google account must be
  a **Viewer** on the folder (My Drive: share the "SiteVerify Bills" folder; Shared Drive: add them
  as a member with the Viewer role). Viewers can look but can't delete or edit.
- 9 new tests (66 total): role access, not-connected state, links returned, no secrets leaked,
  accountants still blocked from connect/disconnect/switch.
- Verified live (`0fb9ebb`): CI passed. On the live API, the supervisor gets 403 and the accountant
  gets the links but 403 on the admin connect route. The live accountant dashboard shows the Drive
  card, and the KH-PRJ-014 gallery's Drive link opens that project's folder. It took one extra
  reload to appear (see open item 4b).

### 2026-10-03 — Roadmap step 9: scaling

Measured on the live site first, then fixed what the numbers showed:

- **Slow first action (login / send / match):** Render's free plan puts the backend to sleep after
  15 minutes with no requests, and the next request waits for it to start back up. That's not a
  code bug. When awake: gallery 0.24 s, health 0.35 s, login about 1 s (password hashing on the free
  plan's small CPU share). Options are in open item 5.
- **A slow phone upload does *not* block other users.** A request trickled in at 10 KB/s didn't
  delay a parallel request: Render's proxy buffers uploads before they reach the app.
- **Requests were processed one at a time:** 6 simultaneous logins finished 0.65 s apart (the
  sixth waited 4.1 s). New `backend/gunicorn.conf.py`: gthread worker with 8 threads, so work that
  waits on Postgres, Supabase or Drive overlaps; 120 s timeout. CPU-bound work like password
  checks still needs a bigger instance to run in parallel. CI now boots gunicorn with this config
  and fires 10 concurrent requests. `gunicorn==26.2.0` is now pinned in `requirements.txt`.
- **Photos shrunk on the phone before upload/queue** (`frontend/src/lib/compressImage.ts`):
  longest side 2000 px, JPEG 80%. A 6.8 MB test image became 705 KB in 0.3 s with small printed
  figures still clearly readable. If the browser can't decode a photo, the original is sent.
- **Gallery thumbnails load only when scrolled near** (`AuthImage`). Before, opening a gallery
  downloaded every bill's full photo (3 live bills = 18.7 MB). With 12 test bills, 6 loaded on open
  and the rest on scroll.
- **Database:** migration `d5267578692f` adds indexes on deliveries (project+upload time, uploader,
  status). `pool_pre_ping` stops stale connections failing the first request after the server
  wakes. The admin user list no longer runs 2 queries per user; a test pins this (it was 8 → 28
  queries after adding 10 users, and is now constant). 57 tests in total.
- Checked and *not* an issue: lazy-loading each bill's uploader. SQLAlchemy reuses users it has
  already loaded, so the cost grows with the number of people, not bills.
- Not done yet: pagination of very long bill lists, and small thumbnail files. Worth doing once a
  project has thousands of bills.
- **Verified live (commit `9a96b4e`):**
  - CI passed, including the new gunicorn smoke test.
  - The Render log shows `Using worker: gthread` (earlier deploys said `sync`) and the index
    migration running on production Postgres.
  - The live frontend bundle contains the photo-shrinking and lazy-thumbnail code.
- **Trade-off measured on live:** with logins and gallery loads mixed, galleries now return in
  0.7–1.9 s while logins run, instead of queuing behind them. But **6 logins in the same second**
  now all finish around 5 s, where before they were served one after another (0.9 → 4.1 s, average
  ~2.5 s). Logins are pure CPU work, and the free plan's CPU slice is the ceiling; threads share it
  evenly. Kept, because real traffic is mostly galleries and uploads, and a login lasts 7 days. A
  paid instance with more CPU fixes both cases.

### 2026-10-03 — Roadmap step 6: CI/CD

- `.github/workflows/ci.yml` runs on every push to `main` and every pull request. Two jobs: backend
  `pytest` on Python 3.14, and frontend `npm ci` + `npm run lint` + `npm run build` on Node 24.
- Render's auto-deploy for **both** services (`vsitebill-api`, `vsitebill-app`) is now set to
  "After CI Checks Pass" (Render → service → Settings → Deploy → Auto-Deploy). It was set in the
  dashboard; `render.yaml` records it as `autoDeployTrigger: checksPass`.
- Replaced the deprecated `Model.query.get()` with `db.session.get()` across the backend. This
  removed the warnings the tests had been silencing, and was the first change sent through the full
  CI-then-deploy chain.
- **Verified the gate end to end:** after the push, the live API stayed on the old commit while CI
  ran. CI passed and Render then auto-deployed `e2ef4f2`.
- **Fixed a live-site bug found while checking:** opening or refreshing any page other than `/`
  (e.g. `/login`, `/supervisor`, or the `/admin?drive=…` page the Google Drive connect flow returns
  to) gave Render's "Not Found". The rewrite rule in `render.yaml` had never been applied (same cause
  as the missing `DATABASE_URL`). Added it in the dashboard (vsitebill-app → Redirects/Rewrites:
  `/*` → `/index.html`, Rewrite). All routes now return 200.
- Checked on the live site: the supervisor's All bills tab shows the user's real bills from today
  and yesterday, with photos served from Supabase.

### 2026-10-03 — Roadmap step 5: automated tests

- Added a pytest suite in `backend/tests/` (54 tests, ~40 s):
  - `test_auth.py`: login, wrong/unknown credentials (same error either way), token checks,
    forgot-password not revealing which numbers have accounts.
  - `test_permissions.py`: every admin route returns 401 to anonymous users and 403 to supervisors
    and accountants.
  - `test_deliveries.py`: upload → login-protected photo access → flag → match, bills persist, the
    per-project and office counts, the supervisor's today view, Save to Drive with no account, and
    a regression test for the IST timestamp bug.
  - `test_admin.py`: create user (who can then log in), duplicate/invalid input, the full
    password-reset flow, creating a project.
  - `test_migrations.py`: fails if `models.py` changes without a migration. Verified by adding a
    column temporarily and watching it fail.
- `create_app()` now takes an optional `test_config`, so tests use a temporary SQLite database and
  upload folder with the S3 and Google settings blanked; they never touch real storage. The schema
  is built through the real migrations.
- New `backend/requirements-dev.txt` (pytest) and `backend/pytest.ini`. Removed a deprecated call
  from `backend/migrations/env.py`.
- **Supervisor project screen** now has three tabs: Waiting to send (the offline queue) · Sent today
  · All bills. Previously it showed only today's bills, so older ones disappeared from the
  supervisor's view. Each card shows the date, quantity, PO number and status, plus the office's
  note when a bill is flagged. The bill card body is now shared with the accountant gallery
  (`frontend/src/components/BillSummary.tsx`). A test now covers the supervisor's "all my bills" query
  (55 tests).
- Note: the local app and the live site have separate databases. A bill added on one doesn't show
  on the other.

### 2026-10-03 — Two-machine workflow docs

- Added `CLAUDE.md` (instructions Claude Code loads automatically on any machine), this progress
  log, `docs/PROJECT_OVERVIEW.md`, and a `README.md` with setup steps for a new machine.

### 2026-10-02 — Roadmap steps 1 & 2, production database fix, gallery redesign

- **Technical guide written** as a Claude Docs doc (link above): architecture, every design choice
  explained, and the production roadmap.
- **Roadmap step 1: Flask-Migrate/Alembic** replaced the hand-rolled `migrations.py` patcher.
  Baseline migration: `backend/migrations/versions/270b5432bd40_baseline_schema.py`. App startup no
  longer calls `db.create_all()`. (commit `786033f`)
- **Found and fixed a production problem:** `vsitebill-api` had **no `DATABASE_URL`** set, so the
  live site had been silently running on a throwaway SQLite file that was wiped on every deploy. The
  `vsitebill-db` Postgres had never been used. Fixed on Render:
  - added `DATABASE_URL` (linked to `vsitebill-db`) and `FLASK_APP=app.py`;
  - start command is now `flask db upgrade && gunicorn app:app`;
  - pinned the driver to `postgresql+psycopg2://` in `config.py`, because SQLAlchemy had picked the
    uninstalled psycopg v3 (commit `271b834`).
  - Consequence: production Postgres started empty and was seeded with the demo accounts and the 3
    starter projects. Anything created on the live site before this, including the Google Drive
    connection, was already lost to the SQLite resets.
- **Roadmap step 2: photo storage.** New `backend/siteverify/storage.py` uses a generic
  S3-compatible client (boto3, SigV4, path-style addressing). `/uploads/<file>` stays login-protected
  and redirects to a 5-minute signed URL. Falls back to local disk when `S3_*` isn't set.
  Cloudflare R2 was tried first but abandoned (it requires a card, which was declined), and replaced
  with **Supabase Storage**, which needs no card. Bucket: `siteverify-bills`. Verified the full round
  trip locally against the real bucket. The user added the five `S3_*` env vars on Render and
  deployed. (commit `77540b5`)
- **Accountant gallery redesign:** All / Pending / Flagged / Matched tabs with counts. "Flagged" is
  the existing "Flag for follow-up" action (API status `REVIEW`) and was previously mixed in with new
  uploads under "To review". Bill cards show delivered/ordered/PO/note/uploader/Drive status. The
  dashboard shows Pending / Flagged / Matched-this-month tiles plus per-project counts. The review
  screen shows the current status. (commit `25d1bf5`)
- **Timezone bug fixed:** timestamps were shown 5h30m early (UTC read as local time). Now serialized
  with an explicit UTC offset via `iso_utc()` in `models.py`.
- Wording standardized on "bill"; the greeting now follows the time of day.
- Verified that bills persist across a backend restart: 8 test bills created, flagged and matched,
  then confirmed, then deleted again (database rows and bucket objects).

### 2026-09-26 — Google Drive sync, admin deliveries view

- Google Drive sync: one admin-connected Google account (OAuth2 with PKCE; scopes `drive.file`,
  `drive.metadata.readonly`, `openid`, `userinfo.email`). A root folder plus one folder per project,
  created eagerly, with Shared Drive support. The accountant's "Save to Drive" uploads the bill
  renamed `<PROJECT-CODE>-<seq>-<vendor>-<date>.jpg` with per-project numbering. (commit `9274dfa`)
- Admin Deliveries tab (all bills across projects) and clickable overview tiles.
- Fixed the office stats query that used SQLite-only `strftime()`, which broke on Postgres; also
  cleaned up dev artifacts. (commit `c544119`)

### 2026-09-19 — Initial build and deployment config

- Built the app from the Claude Design canvas: React 19 + TypeScript + Vite + Tailwind v4 frontend,
  Flask + SQLAlchemy backend, JWT auth with role-based routes (supervisor / accountant / admin).
- Demo login accounts only, no fabricated records. Authenticated photo viewer. Admin panel for
  users, projects and admin-mediated password resets.
- Native camera capture; offline-first upload queue (IndexedDB) plus a PWA service worker.
- Render deployment config (`render.yaml`). (commits `1cec603`, `d4d9957`)

---

## Template for a new entry

```markdown
### YYYY-MM-DD — Short title (office/home)

- What changed (with commit hashes)
- What was verified, and how
- Anything left half-done, or decisions waiting on the user
```
