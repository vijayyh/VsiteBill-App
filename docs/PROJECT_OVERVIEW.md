# SiteVerify — Project overview

A one-file summary of the whole project: what it does, who uses it, how it's built, and where
things live. For the step-by-step history see [PROGRESS.md](PROGRESS.md). For the in-depth "why
every choice was made" write-up, see the technical guide:
https://claude.ai/code/artifact/b63f0fa5-c550-4459-85e0-6646b4a24850

---

## What it does

On KH Group / Sustaniq construction sites, every material delivery (cement, steel, …) arrives
with a paper bill (delivery challan). Those bills have to be checked against the purchase order
(PO), so shortfalls and over-deliveries get caught before the vendor is paid.

SiteVerify replaces the paper chase:

1. The **site supervisor** photographs the bill on their phone and types in the vendor, item and
   quantity. It works with no signal: the bill waits on the phone and sends itself once the phone
   is back online.
2. The **office / accountant** sees every bill per project, compares delivered vs ordered quantity,
   and marks it **Matched** or **Flagged** for follow-up, with a note.
3. The accountant can save any bill to a company **Google Drive** archive, sorted into one folder
   per project and numbered in sequence (`KH-PRJ-014-001-UltraTech-2026-10-02.jpg`).
4. The **admin** manages user accounts, projects, password resets and the Drive connection, and can
   see every bill across all projects.

## Users and roles

| Role | Can do |
|---|---|
| Site supervisor | Pick a project → take/choose a photo → enter bill details → send (offline-capable). Sees their own bills from today. |
| Office / accountant | Dashboard with Pending / Flagged / Matched-this-month counts. Per-project gallery (All / Pending / Flagged / Matched). Review a bill, edit details, flag or match it, save it to Drive. Open the Drive archive and each project's folder, view-only. |
| Admin | Overview stats, create users and reset passwords, create/edit projects, connect Google Drive (and pick a Shared Drive), view all bills. |

Login is by phone number + password. There's no SMS or email: "Forgot password" files a request
that an admin resolves by setting a temporary password.

## Bill lifecycle

```
Supervisor sends bill ──► PENDING ──► accountant reviews ──┬──► MATCHED  (quantities agree)
                                                           └──► FLAGGED  (API status "REVIEW":
                                                                          mismatch / follow-up)
MATCHED or FLAGGED bills can be re-opened and changed at any time.
Any bill can be saved to Google Drive; bills are never deleted by the app.
```

## Architecture

```
 Phone / browser (PWA)                     Render                         External
┌──────────────────────┐   HTTPS/JSON   ┌───────────────────┐
│ React app            │ ─────────────► │ vsitebill-api     │ ──► Postgres (vsitebill-db)
│ (static files on     │   JWT bearer   │ Flask + gunicorn  │ ──► Supabase Storage
│  vsitebill-app)      │                │                   │       (bill photos, S3 API)
│ IndexedDB upload     │ ◄── photo ──── │ /uploads/<file>   │ ──► Google Drive API
│ queue + service      │  302 → signed  │  → signed URL     │       (bill archive)
│ worker (offline)     │  Supabase URL  └───────────────────┘
└──────────────────────┘
```

- The **frontend** is a single-page app compiled to static files (no server process in production).
- The **backend** is a stateless JSON API: auth is a signed JWT, not a server session, so any number
  of instances could run.
- **Photos** are never served through public links: `/uploads/<file>` checks login, then redirects
  to a signed Supabase URL that expires after 5 minutes.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7 |
| Offline | `vite-plugin-pwa` (service worker caches the app shell), `idb` (IndexedDB upload queue) |
| Backend | Python 3.14, Flask 3, Flask-SQLAlchemy, Flask-Migrate (Alembic), PyJWT, gunicorn |
| Database | SQLite for local development, PostgreSQL in production |
| Photo storage | Supabase Storage via its S3-compatible API (boto3); local disk fallback in dev |
| Archive | Google Drive API v3 (OAuth2 + PKCE, one admin-connected account) |
| Hosting | Render: static site + web service + managed Postgres |

## Data model (`backend/siteverify/models.py`)

| Table | Holds |
|---|---|
| `users` | name, initials, phone (login), password hash, role (`supervisor`/`accountant`/`admin`) |
| `projects` | id (`kh-014`), code (`KH-PRJ-014`), name, colour; Drive folder id + next bill number |
| `deliveries` | one bill: project, uploader, vendor, item, PO no., ordered/delivered qty, note, status, photo filename, upload time, Drive file id/link/sync time |
| `password_reset_requests` | "forgot password" requests and who resolved them |
| `google_drive_account` | the single connected Google account (refresh token, root folder, chosen Shared Drive) |
| `drive_oauth_state` | short-lived PKCE verifier between "Connect Drive" and Google's callback |

Schema changes go through Flask-Migrate (`backend/migrations/`); see the README.

## API (`backend/siteverify/routes/`)

| Prefix | Endpoints |
|---|---|
| `/api/auth` | `POST /login`, `GET /me`, `POST /forgot-password` |
| `/api/projects` | list (with pending/flagged/matched counts), get one, list a project's bills |
| `/api` | `POST /projects/<id>/deliveries` (upload), `GET`/`PATCH /deliveries/<id>`, `POST /deliveries/<id>/save-to-drive` |
| `/api/office` | `GET /stats` (pending, flagged, matched this month), `GET /drive` (read-only Drive links; accountant + admin) |
| `/api/admin` | overview, all bills, users (create, reset password), password-reset requests, projects (create, edit), Drive (status, connect, callback, disconnect, shared drives) |
| `/uploads/<file>` | login-protected photo access (redirects to a signed storage URL) |
| `/api/health` | uptime check used by Render |

## Deployment

| Piece | Where |
|---|---|
| Frontend | Render static site `vsitebill-app` → https://vsitebill-app.onrender.com |
| Backend | Render web service `vsitebill-api` → https://vsitebill-api.onrender.com. Start command: `flask db upgrade && gunicorn app:app` |
| Database | Render Postgres `vsitebill-db` (free tier, **expires 2026-10-19 unless upgraded**) |
| Photos | Supabase project → Storage bucket `siteverify-bills` |
| Google OAuth client | Google Cloud Console (Workspace domain `sustaniq.in`, consent screen "Internal") |

Both Render services auto-deploy on every push to `main`. The Render services are **not**
Blueprint-synced: `render.yaml` documents the setup, but env vars and commands are changed in the
Render dashboard.

### Backend environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (linked from `vsitebill-db`). Unset locally, which means SQLite |
| `FLASK_APP` | `app.py`, so `flask db upgrade` can find the app |
| `JWT_SECRET` | signs login tokens |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google Drive OAuth |
| `FRONTEND_URL` | where the Drive OAuth flow sends the admin back to |
| `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` | photo storage. Unset locally, which means local disk |

The frontend's only setting is `VITE_API_BASE`, the backend URL; locally it defaults to `:5000`.

## Repository map

```
backend/
  app.py                    entry point (dev server: python app.py)
  requirements.txt
  migrations/               Flask-Migrate / Alembic schema history
  siteverify/
    __init__.py             create_app(): config, blueprints, /uploads route, seeding
    config.py               all settings, read from env vars / backend/.env
    models.py               database tables
    auth.py                 JWT issue/verify, login_required / require_role
    storage.py              photo storage (Supabase S3 or local disk)
    drive.py                Google Drive OAuth + uploads
    seed.py                 demo accounts + starter projects (first run only)
    routes/                 auth, projects, deliveries, office, admin
frontend/
  src/
    App.tsx                 routes per role
    lib/                    api client, session, offline queue, types, status labels, date formatting
    components/             shared UI (headers, status badge, authenticated image, photo viewer, …)
    screens/                Login, ForgotPassword, supervisor/, accountant/, admin/
render.yaml                 Render setup (documentation; see note above)
CLAUDE.md                   working instructions for Claude Code
docs/                       this overview + the progress log
```
