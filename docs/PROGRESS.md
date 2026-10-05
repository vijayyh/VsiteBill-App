# SiteVerify — Progress log

The running record of what's been done and what's next, so work can continue on either machine
(office or home). **Update this at the end of every working session, then commit and push.**

---

## Where we left off

_Last updated: 2026-10-05 (home machine)_

**State:** Roadmap steps 1 (migrations), 2 (photo storage), 5 (tests), 6 (CI/CD) and 9 (scaling)
are done and live. Steps 3, 4, 7 and 8 were skipped for now. Every push runs the backend tests
(86) plus frontend lint and build on GitHub, and Render deploys only after they pass. Production
runs on Postgres with photos in Supabase.

**UI redesign is live** (merged to `main` as `ea02c99` on 2026-10-05, CI passed, checked on the
live site). Glass style, bottom bar per role, in-app alerts, Profile, colour project headers.

**Bug/security fixes from the full test pass (2026-10-05, home):** live (`8f97631`, CI passed,
deployed). See the session log.

**Next step:** the user decides how to handle the free-plan sleep (open item 5). Still open:
roadmap steps 3, 4, 7 and 8, and the security items at the top of the list below.

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
6. Open question from the technical guide: **OCR provider**, Google Cloud Vision vs AWS Textract.
7. ~~Bill photos are 5–7 MB each~~: fixed in step 9 (photos are now shrunk on the phone before
   upload). The 3 bills uploaded before that are still full size.
8. Tidy-up (Supabase storage is now confirmed working on production): `render.yaml` still declares the old
   `delivery-uploads` disk, which is no longer needed.

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
