from pathlib import Path

import pytest
from flask_migrate import upgrade

from siteverify import create_app
from siteverify.seed import DEMO_PASSWORD, seed_if_empty

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

PHONES = {
    "supervisor": "+91 98200 00001",
    "accountant": "+91 98200 00002",
    "admin": "+91 98200 00009",
}


@pytest.fixture
def app(tmp_path):
    # Every test gets its own SQLite file and upload folder. The S3/Google
    # settings are blanked so a developer's backend/.env can never make a test
    # touch the real storage bucket or Google Drive.
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
            "UPLOAD_DIR": tmp_path / "uploads",
            "JWT_SECRET": "test-secret",
            "S3_ENDPOINT_URL": "",
            "S3_ACCESS_KEY_ID": "",
            "S3_SECRET_ACCESS_KEY": "",
            "S3_BUCKET": "",
            "GOOGLE_CLIENT_ID": "",
            "GOOGLE_CLIENT_SECRET": "",
        }
    )
    with app.app_context():
        # Build the schema the same way production does, so a broken migration fails the suite.
        upgrade(directory=str(MIGRATIONS_DIR))
        seed_if_empty()
    yield app
    with app.app_context():
        from siteverify.extensions import db

        db.session.remove()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def login(client):
    """login("accountant") -> Authorization headers for that demo account."""

    def _login(role: str) -> dict:
        res = client.post("/api/auth/login", json={"phone": PHONES[role], "password": DEMO_PASSWORD})
        assert res.status_code == 200, res.get_json()
        return {"Authorization": f"Bearer {res.get_json()['token']}"}

    return _login
