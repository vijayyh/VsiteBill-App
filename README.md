# SiteVerify

Delivery-bill verification for KH Group / Sustaniq construction sites. Site supervisors photograph
delivery bills on their phones, even with no signal. The office checks each bill against its
purchase order and marks it **Matched** or **Flagged**, and bills are archived to Google Drive by
project.

- **Live app:** https://vsitebill-app.onrender.com
- **What it is and how it's built:** [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)
- **What's been done and what's next:** [docs/PROGRESS.md](docs/PROGRESS.md)
- **In-depth technical guide + production roadmap:**
  https://claude.ai/code/artifact/b63f0fa5-c550-4459-85e0-6646b4a24850

Stack: React 19 + TypeScript + Vite + Tailwind (PWA, offline upload queue) · Flask + SQLAlchemy +
Flask-Migrate · Postgres on Render · Supabase Storage for photos · Google Drive API.

---

## Working from two machines (office ↔ home)

GitHub is the sync point. Three things do **not** travel through git, by design:

| Not in git | Why | What to do |
|---|---|---|
| `backend/.env` (secrets) | Must never be in a public repo | Create it once per machine (see setup step 3) |
| Local database (`backend/siteverify.db`) | Each machine has its own throwaway dev data | Created by `flask db upgrade`; the real data lives in production Postgres |
| Claude's memory | Stored per machine | `CLAUDE.md` + `docs/PROGRESS.md` hold everything Claude needs |

**Starting a session (either machine):**

1. `git pull`
2. If `backend/requirements.txt` or `frontend/package.json` changed, re-run the install commands
   below. If there are new files in `backend/migrations/versions/`, run `flask db upgrade`.
3. Open Claude Code in this folder and say "let's continue". It reads `CLAUDE.md` automatically and
   picks up from the "Where we left off" section of `docs/PROGRESS.md`.

**Ending a session:** ask Claude to "update the progress log and push" (or edit
`docs/PROGRESS.md` yourself, then commit and push). If you skip this, the other machine won't have
your changes.

---

## Setting up a new machine

Install first: **Git**, **Python 3.14**, **Node.js 22+**, and Claude Code (desktop app).

### 1. Get the code

```bash
git clone https://github.com/vijayyh/VsiteBill-App.git
cd VsiteBill-App
```

### 2. Backend dependencies

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 3. Secrets: `backend/.env`

Copy the template, then fill it in:

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

Copy the values from the Render dashboard → `vsitebill-api` → **Environment** (click the eye icon
to reveal each one), with these local-machine differences:

- `GOOGLE_REDIRECT_URI=http://localhost:5000/api/admin/drive/callback` and
  `FRONTEND_URL=http://localhost:5173`. These are local values, not the production ones.
- Leave `DATABASE_URL` out, so local development uses a SQLite file.
- `S3_*` is optional. Leave it empty to keep local test photos on local disk. If you fill it in,
  local uploads go into the **same bucket as production**.

### 4. Create the local database

From `backend/`:

```bash
.venv/Scripts/flask db upgrade     # macOS/Linux: .venv/bin/flask db upgrade
```

The first time the app starts, it creates the demo login accounts and the three starter projects
(see `backend/siteverify/seed.py`).

### 5. Frontend dependencies

```bash
cd ../frontend
npm install
```

### 6. Run it

The easiest way: in Claude Code, ask to start the preview. It uses `.claude/launch.json` to run both
servers and opens the app.

> On macOS/Linux, change the backend path in `.claude/launch.json` from
> `backend/.venv/Scripts/python.exe` to `backend/.venv/bin/python`.

Manually, in two terminals:

Terminal 1, the API on http://localhost:5000:

```bash
cd backend
.venv/Scripts/python app.py      # macOS/Linux: .venv/bin/python app.py
```

Terminal 2, the app on http://localhost:5173:

```bash
cd frontend
npm run dev
```

The backend does **not** auto-reload. Restart it after changing Python code.

---

## Running the tests

Install the test tools once (from `backend/`), then run the suite:

```bash
.venv/Scripts/python -m pip install -r requirements-dev.txt     # macOS/Linux: .venv/bin/python …
.venv/Scripts/python -m pytest
```

Each test runs against its own temporary database and upload folder, so it never touches your
local data, the Supabase bucket or Google Drive. The suite covers login and tokens, role
permissions on every admin route, the bill flow (upload → photo access → flag → match → counts),
admin user/password/project management, and a check that the migrations match `models.py`.

## Changing the database schema

1. Edit the models in `backend/siteverify/models.py`.
2. From `backend/`: `.venv/Scripts/flask db migrate -m "describe the change"`, then review the new
   file in `backend/migrations/versions/`.
3. `.venv/Scripts/flask db upgrade` to apply it locally.
4. Commit the migration file. Production applies it automatically on the next deploy.

## Deploying

Push to `main`. GitHub Actions (`.github/workflows/ci.yml`) then runs the backend tests and the
frontend lint, type check and build. You'll see ✅ or ❌ next to the commit on GitHub, and an email
if it fails. Render is set to **deploy only after those checks pass**, so a failing push never
reaches the live site; the last working version keeps running until a fix is pushed. Both services
then rebuild: the frontend static site `vsitebill-app` and the API `vsitebill-api`. The API's start
command runs `flask db upgrade` before starting gunicorn.

Production settings (env vars, start command) are managed in the **Render dashboard**. `render.yaml`
documents them but isn't applied automatically.
