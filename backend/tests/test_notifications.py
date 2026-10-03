import io

from siteverify.seed import DEMO_PASSWORD

from conftest import PHONES


def upload(client, headers, project_id="kh-014", vendor="UltraTech"):
    res = client.post(
        f"/api/projects/{project_id}/deliveries",
        data={"photo": (io.BytesIO(b"x"), "b.jpg"), "vendor": vendor},
        headers=headers,
        content_type="multipart/form-data",
    )
    return res.get_json()["delivery"]["id"]


def alerts(client, headers):
    return client.get("/api/notifications", headers=headers).get_json()


def test_new_bill_alerts_accountants_only(client, login):
    supervisor, accountant, admin = login("supervisor"), login("accountant"), login("admin")
    bill_id = upload(client, supervisor)

    acc = alerts(client, accountant)
    assert acc["unreadCount"] == 1
    item = acc["notifications"][0]
    assert item["kind"] == "bill_new"
    assert item["title"] == "New bill from Ramesh Patil"
    assert item["body"] == "KH-PRJ-014 · UltraTech"
    assert item["link"] == f"/accountant/projects/kh-014/review/{bill_id}"
    assert alerts(client, supervisor)["unreadCount"] == 0
    assert alerts(client, admin)["unreadCount"] == 0


def test_flag_and_match_alert_the_supervisor_once_per_change(client, login):
    supervisor, accountant = login("supervisor"), login("accountant")
    bill_id = upload(client, supervisor)

    client.patch(f"/api/deliveries/{bill_id}", json={"status": "REVIEW", "note": "Short by 20 bags"}, headers=accountant)
    client.patch(f"/api/deliveries/{bill_id}", json={"note": "Short by 20 bags, vendor called"}, headers=accountant)
    client.patch(f"/api/deliveries/{bill_id}", json={"status": "MATCHED"}, headers=accountant)

    items = alerts(client, supervisor)["notifications"]
    assert [i["kind"] for i in items] == ["bill_matched", "bill_flagged"]  # newest first, no duplicate
    assert items[1]["title"] == "Bill flagged: UltraTech"
    assert items[1]["body"] == "Short by 20 bags"
    assert items[0]["link"] == "/supervisor/projects/kh-014"


def test_no_alert_for_changing_your_own_bill(client, login):
    admin = login("admin")
    bill_id = upload(client, admin)
    client.patch(f"/api/deliveries/{bill_id}", json={"status": "MATCHED"}, headers=admin)
    assert alerts(client, admin)["unreadCount"] == 0


def test_password_reset_request_alerts_admins_once(client, login):
    for _ in range(2):
        client.post("/api/auth/forgot-password", json={"phone": PHONES["supervisor"]})
    items = alerts(client, login("admin"))["notifications"]
    assert len(items) == 1
    assert items[0]["kind"] == "password_reset"
    assert items[0]["title"] == "Ramesh Patil asked for a password reset"


def test_marking_alerts_read(client, login):
    supervisor, accountant = login("supervisor"), login("accountant")
    upload(client, supervisor, vendor="A")
    upload(client, supervisor, vendor="B")
    first_id = alerts(client, accountant)["notifications"][0]["id"]

    assert client.get("/api/notifications/unread-count", headers=accountant).get_json() == {"count": 2}
    assert client.post(f"/api/notifications/{first_id}/read", headers=accountant).status_code == 200
    assert client.get("/api/notifications/unread-count", headers=accountant).get_json() == {"count": 1}

    # Someone else's alert can't be touched.
    assert client.post(f"/api/notifications/{first_id}/read", headers=supervisor).status_code == 404

    client.post("/api/notifications/read-all", headers=accountant)
    body = alerts(client, accountant)
    assert body["unreadCount"] == 0
    assert all(i["read"] for i in body["notifications"])


def test_change_password(client, login):
    headers = login("supervisor")
    change = lambda cur, new: client.post(  # noqa: E731
        "/api/auth/change-password", json={"currentPassword": cur, "newPassword": new}, headers=headers
    )

    assert change("wrong", "longenough1").status_code == 400
    assert change(DEMO_PASSWORD, "short").status_code == 400
    assert change(DEMO_PASSWORD, DEMO_PASSWORD).status_code == 400
    assert change(DEMO_PASSWORD, "brand-new-pass").status_code == 200

    old = client.post("/api/auth/login", json={"phone": PHONES["supervisor"], "password": DEMO_PASSWORD})
    new = client.post("/api/auth/login", json={"phone": PHONES["supervisor"], "password": "brand-new-pass"})
    assert old.status_code == 401
    assert new.status_code == 200


def test_change_password_requires_login(client):
    assert client.post("/api/auth/change-password", json={}).status_code == 401
