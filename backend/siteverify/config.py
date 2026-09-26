import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"

# app.py runs via `python app.py`, not the `flask run` CLI, so Flask's
# automatic .env loading (which only triggers under the CLI) never happens —
# load it explicitly instead. No-op in production (Render sets real env vars,
# no .env file is deployed).
load_dotenv(BASE_DIR / ".env")


def _normalize_database_url(url: str) -> str:
    # Some providers (Render's connection string included, historically Heroku's)
    # hand out "postgres://", but SQLAlchemy 2.x only recognizes "postgresql://".
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


class Config:
    SQLALCHEMY_DATABASE_URI = _normalize_database_url(
        os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'siteverify.db'}")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
    JWT_EXPIRES_HOURS = 24 * 7
    UPLOAD_DIR = UPLOAD_DIR
    MAX_CONTENT_LENGTH = 15 * 1024 * 1024  # 15 MB per upload

    # Google Drive sync (see siteverify/drive.py). Unset until an admin connects
    # an account and these three are filled in from Google Cloud Console.
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.environ.get(
        "GOOGLE_REDIRECT_URI", "http://localhost:5000/api/admin/drive/callback"
    )
    # Where the OAuth callback sends the admin's browser back to when it's done.
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
