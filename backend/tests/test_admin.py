from conftest import PHONES


def test_admin_creates_a_user_who_can_then_log_in(client, login):
    res = client.post(
        "/api/admin/users",
        json={"name": "Suresh Kale", "phone": "+91 90000 11111", "role": "supervisor"},
        headers=login("admin"),
    )
    assert res.status_code == 201
    body = res.get_json()
    assert body["user"]["initials"] == "SK"

    new_login = client.post(
        "/api/auth/login", json={"phone": "+91 90000 11111", "password": body["temporaryPassword"]}
    )
    assert new_login.status_code == 200
    assert new_login.get_json()["user"]["role"] == "supervisor"


def test_duplicate_phone_and_bad_role_are_rejected(client, login):
    admin = login("admin")
    dup = client.post(
        "/api/admin/users", json={"name": "Copy", "phone": PHONES["supervisor"], "role": "supervisor"}, headers=admin
    )
    assert dup.status_code == 409
    bad_role = client.post(
        "/api/admin/users", json={"name": "X", "phone": "+91 1", "role": "owner"}, headers=admin
    )
    assert bad_role.status_code == 400


def test_resolving_a_reset_request_sets_a_working_new_password(client, login):
    client.post("/api/auth/forgot-password", json={"phone": PHONES["supervisor"]})
    admin = login("admin")

    pending = client.get("/api/admin/password-resets", headers=admin).get_json()["requests"]
    assert len(pending) == 1

    res = client.post(f"/api/admin/password-resets/{pending[0]['id']}/resolve", headers=admin)
    assert res.status_code == 200
    new_password = res.get_json()["temporaryPassword"]

    assert client.post("/api/auth/login", json={"phone": PHONES["supervisor"], "password": new_password}).status_code == 200
    again = client.post(f"/api/admin/password-resets/{pending[0]['id']}/resolve", headers=admin)
    assert again.status_code == 409


def test_admin_creates_a_project_once(client, login):
    admin = login("admin")
    payload = {"code": "KH-PRJ-030", "name": "Pune Batching Plant", "accent": "forest"}

    created = client.post("/api/admin/projects", json=payload, headers=admin)
    assert created.status_code == 201
    assert created.get_json()["project"]["id"] == "kh-prj-030"

    assert client.post("/api/admin/projects", json=payload, headers=admin).status_code == 409
