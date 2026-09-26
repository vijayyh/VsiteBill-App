import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"


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
