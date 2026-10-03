# SiteVerify — Progress log

The running record of what's been done and what's next, so work can continue on either machine
(office or home). **Update this at the end of every working session, then commit and push.**

---

## Where we left off

_Last updated: 2026-10-03 (office machine)_

**State:** Roadmap steps 1 (migrations), 2 (photo storage) and 5 (automated tests) are done. Steps
3 and 4 were deliberately skipped for now and are still open. Production runs on real Postgres and
stores bill photos in Supabase Storage. The backend has a 54-test pytest suite (`backend/tests/`).

**Waiting on the user:** feedback on step 5 (the test suite). Also still to check: the live site
after adding the `S3_*` env vars on Render. Upload a bill and confirm it appears in Supabase →
Storage → `siteverify-bills`.

**Next step:** step 6 (CI/CD: GitHub Actions runs this test suite on every push), which builds
directly on step 5. Steps 3 and 4 are still open, and so is the security item at the top of the
list below.

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
4. **Reconnect Google Drive on production.** The old Drive connection lived in the throwaway SQLite
   database (see 2026-10-02) and is gone. The admin needs to click "Connect Google Drive" again on
   the live site.
5. The `vsitebill-api` web service is on Render's **free plan**: it sleeps when idle, and the first
   request then takes ~50 seconds. Upgrade before real site use.
6. Open question from the technical guide: **OCR provider**, Google Cloud Vision vs AWS Textract.
7. Tidy-up once Supabase storage is confirmed on production: `render.yaml` still declares the old
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
| 7 | Monitoring: Sentry, structured logs, uptime checks | Not started |
| 8 | OCR on bill photos | Not started (provider undecided) |
| 9 | Scaling | Not started |

---

## Session log

Newest first. Each entry: what changed, what was verified, anything left half-done.

### 2026-10-03 — Roadmap step 6: CI/CD

- `.github/workflows/ci.yml` runs on every push to `main` and every pull request. Two jobs: backend
  `pytest` on Python 3.14, and frontend `npm ci` + `npm run lint` + `npm run build` on Node 24.
- Render's auto-deploy for **both** services (`vsitebill-api`, `vsitebill-app`) is now set to
  "After CI Checks Pass" (Render → service → Settings → Deploy → Auto-Deploy). It was set in the
  dashboard; `render.yaml` records it as `autoDeployTrigger: checksPass`.
- Replaced the deprecated `Model.query.get()` with `db.session.get()` across the backend. This
  removed the warnings the tests had been silencing, and was the first change sent through the full
  CI-then-deploy chain.

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
