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
        url = "postgresql://" + url[len("postgres://") :]
    # Pin the driver to psycopg2 (installed via requirements.txt) explicitly —
    # a bare "postgresql://" lets SQLAlchemy pick a default driver, which can
    # resolve to psycopg (v3, not installed) instead.
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


class Config:
    SQLALCHEMY_DATABASE_URI = _normalize_database_url(
        os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'siteverify.db'}")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Render's Postgres drops idle connections (e.g. while the free web service
    # sleeps); test each pooled connection before use instead of failing the
    # first request after a quiet spell.
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
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

    # S3-compatible object storage for delivery photos (Supabase Storage,
    # Backblaze B2, Cloudflare R2, AWS S3, ...) — see siteverify/storage.py.
    # Left unset in local dev, which falls back to reading/writing UPLOAD_DIR
    # on local disk instead.
    S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "")
    S3_ACCESS_KEY_ID = os.environ.get("S3_ACCESS_KEY_ID", "")
    S3_SECRET_ACCESS_KEY = os.environ.get("S3_SECRET_ACCESS_KEY", "")
    S3_BUCKET = os.environ.get("S3_BUCKET", "")
    S3_REGION = os.environ.get("S3_REGION", "us-east-1")

    # Reading bill photos (OCR, see siteverify/ocr.py). Off until GOOGLE_VISION_API_KEY is set: an
    # API key from Google Cloud Console restricted to the Cloud Vision API.
    OCR_PROVIDER = os.environ.get("OCR_PROVIDER", "google")
    GOOGLE_VISION_API_KEY = os.environ.get("GOOGLE_VISION_API_KEY", "")
    OCR_TIMEOUT_SECONDS = float(os.environ.get("OCR_TIMEOUT_SECONDS", "20"))
    # Names on our own side of a bill (the buyer), so they're never taken for the vendor.
    OCR_BUYER_NAMES = os.environ.get("OCR_BUYER_NAMES", "KH Group,Sustaniq")
