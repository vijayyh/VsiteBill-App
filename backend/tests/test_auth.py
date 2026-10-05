from siteverify.models import PasswordResetRequest
from siteverify.seed import DEMO_PASSWORD

from conftest import PHONES


def test_login_returns_token_and_role(client):
    res = client.post("/api/auth/login", json={"phone": PHONES["accountant"], "password": DEMO_PASSWORD})
    assert res.status_code == 200
    body = res.get_json()
    assert body["token"]
    assert body["user"]["role"] == "accountant"
    assert "password_hash" not in body["user"]


def test_login_rejects_wrong_password(client):
    res = client.post("/api/auth/login", json={"phone": PHONES["accountant"], "password": "wrong"})
    assert res.status_code == 401


def test_login_rejects_unknown_phone_with_same_message(client):
    wrong_password = client.post("/api/auth/login", json={"phone": PHONES["admin"], "password": "wrong"})
    unknown_phone = client.post("/api/auth/login", json={"phone": "+91 00000 00000", "password": "x"})
    assert unknown_phone.status_code == 401
    # Same error either way, so the login form can't be used to discover which numbers have accounts.
    assert unknown_phone.get_json() == wrong_password.get_json()


def test_me_requires_a_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_a_tampered_token(client, login):
    headers = login("supervisor")
    headers["Authorization"] += "x"
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_me_returns_the_logged_in_user(client, login):
    res = client.get("/api/auth/me", headers=login("supervisor"))
    assert res.status_code == 200
    assert res.get_json()["user"]["role"] == "supervisor"


def test_forgot_password_does_not_reveal_whether_account_exists(client):
    known = client.post("/api/auth/forgot-password", json={"phone": PHONES["supervisor"]})
    unknown = client.post("/api/auth/forgot-password", json={"phone": "+91 00000 00000"})
    assert known.status_code == unknown.status_code == 200
    assert known.get_json() == unknown.get_json()


def test_forgot_password_only_opens_one_pending_request(client, app):
    for _ in range(3):
        client.post("/api/auth/forgot-password", json={"phone": PHONES["supervisor"], "note": "lost phone"})
    with app.app_context():
        assert PasswordResetRequest.query.filter_by(status="PENDING").count() == 1


def test_api_root_points_to_the_app_instead_of_not_found(client, app):
    res = client.get("/")
    assert res.status_code == 200
    page = res.get_data(as_text=True)
    assert "SiteVerify API is running" in page
    assert f'href="{app.config["FRONTEND_URL"]}"' in page
