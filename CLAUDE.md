# SiteVerify — instructions for Claude

SiteVerify (repo: `vijayyh/VsiteBill-App`) is a mobile-first web app for KH Group / Sustaniq
construction sites: site supervisors photograph delivery bills (challans), the office/accountant
checks each bill against its purchase order and marks it Matched or Flagged, and an admin manages
users, projects and the Google Drive archive. Full overview: [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).

This project is worked on from **two machines** (office and home). Your memory does not carry
between them — this file and `docs/PROGRESS.md` are the shared memory. Treat them that way.

## Every session

**At the start:**
1. Run `git pull` before touching anything.
2. Read the "Where we left off" section of [docs/PROGRESS.md](docs/PROGRESS.md) and tell the user,
   in a few lines, where things stand and what the next step is.

**Before the session ends, or whenever the user says they're stopping:**
1. Add a dated entry to the top of the "Session log" in `docs/PROGRESS.md` (what changed, what was
   verified, anything left half-done), and rewrite "Where we left off".
2. Commit and push, so the other machine can pick up from exactly here.

## How the user wants to work

- **Live preview, never a silent build.** Start the dev servers (`.claude/launch.json`:
  `siteverify-backend` on :5000, `siteverify-frontend` on :5173) and build screen by screen,
  checking each change in the browser preview. Only produce a final build artifact (e.g. an APK)
  when explicitly asked.
- **One roadmap step at a time.** For the production-readiness roadmap in `docs/PROGRESS.md`:
  finish one step, verify it working, then stop for the user's feedback before starting the next.
- **No fabricated data.** Seed only real demo login accounts and the minimum structural data (the
  starter project list). Never seed fake vendors, bills or other activity. If you create test
  records to verify something, delete them afterwards (database rows *and* stored photos).
- **Offline-first for anything a supervisor submits.** Sites often have no signal: capture must
  work with zero connectivity, queue on the device (IndexedDB), and auto-send on reconnect, with a
  clear difference between "waiting for signal" and "sent to office".
- **Native device features over custom UI.** e.g. "Take a photo" opens the phone's own camera
  (`<input type="file" capture="environment">`), not an in-browser camera screen.
- **Git commits:** never add a `Co-Authored-By: Claude …` trailer — the user wants only themselves
  shown as the author on GitHub. Only commit/push when the user asks (or at session end, per above).
- Wording in the UI says **"bill"** (not delivery/challan) for the thing a supervisor uploads.

## Tests

Backend tests live in `backend/tests/` (pytest). Run `.venv/Scripts/python -m pytest` from
`backend/` after any backend change and before committing; add a test for each new endpoint or
bug fix. Tests build their own temporary database via the migrations, through
`create_app(test_config)` in `conftest.py`, and blank the S3/Google settings, so they never touch
real storage.

CI (`.github/workflows/ci.yml`) runs the backend tests plus the frontend `npm run lint` and
`npm run build` on every push, and Render only deploys after it passes. Run the same commands
locally before pushing. A red CI run means the live site did **not** update.

## Gotchas that have bitten before

- **Backend auto-reload is off** (`use_reloader=False` in `backend/app.py`, because Werkzeug left
  orphaned duplicate processes on Windows). Restart the `siteverify-backend` preview after every
  backend code change.
- **Database schema changes go through Flask-Migrate**, never `db.create_all()`:
  `flask db migrate -m "…"` then `flask db upgrade`, run from `backend/` using the venv's `flask`
  (it finds `app.py` on its own). Commit the generated file in `backend/migrations/versions/`.
  Production runs `flask db upgrade` automatically as part of its start command.
- **Render is not Blueprint-synced.** Editing `render.yaml` does *not* change the live services.
  Env vars and the start command must be changed in the Render dashboard; keep `render.yaml` in
  step as documentation.
- **Secrets never go in git.** `backend/.env` is gitignored; `backend/.env.example` lists the keys.
  The live values are in the Render dashboard (vsitebill-api → Environment).
- **Photo storage:** `backend/siteverify/storage.py` uses the S3-compatible bucket when the `S3_*`
  env vars are set, and falls back to local disk (`backend/uploads/`) when they aren't.
- **Production server settings** live in `backend/gunicorn.conf.py` (gthread, 8 threads, 120 s
  timeout), which gunicorn loads automatically. Gunicorn doesn't run on Windows; CI smoke-tests it.
- **Photos are shrunk in the browser before upload** (`frontend/src/lib/compressImage.ts`), and
  gallery thumbnails lazy-load (`AuthImage`). Keep both when touching the upload or gallery code.
- **Render free plan sleeps after 15 min idle.** A slow first request after a quiet spell is that,
  not a bug. Measure before assuming otherwise.
- **Timestamps** are stored as naive UTC; always serialize with `iso_utc()` from `models.py` or
  the browser shows them 5h30m off.
- The `.claude/launch.json` backend path is the Windows venv (`backend/.venv/Scripts/python.exe`).
  On macOS/Linux it is `backend/.venv/bin/python`.
