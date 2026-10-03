import io

PHOTO_BYTES = b"\xff\xd8\xff fake jpeg bytes"


def upload_bill(client, headers, project_id="kh-014", **fields):
    data = {
        "photo": (io.BytesIO(PHOTO_BYTES), "bill.jpg"),
        "vendor": "UltraTech Cement",
        "item": "OPC 53, 50kg bags",
        "delivered": "480",
        "poNumber": "PO-4471",
        **fields,
    }
    return client.post(
        f"/api/projects/{project_id}/deliveries", data=data, headers=headers, content_type="multipart/form-data"
    )


def test_supervisor_upload_creates_a_pending_bill(client, login):
    res = upload_bill(client, login("supervisor"))
    assert res.status_code == 201
    bill = res.get_json()["delivery"]
    assert bill["status"] == "PENDING"
    assert bill["vendor"] == "UltraTech Cement"
    assert bill["delivered"] == 480
    assert bill["uploadedBy"] == "Ramesh Patil"
    assert bill["photoUrl"].startswith("/uploads/")


def test_upload_without_a_photo_is_rejected(client, login):
    res = client.post(
        "/api/projects/kh-014/deliveries",
        data={"vendor": "X"},
        headers=login("supervisor"),
        content_type="multipart/form-data",
    )
    assert res.status_code == 400


def test_upload_to_unknown_project_is_rejected(client, login):
    assert upload_bill(client, login("supervisor"), project_id="nope").status_code == 404


def test_bill_photo_is_only_served_to_logged_in_users(client, login):
    photo_url = upload_bill(client, login("supervisor")).get_json()["delivery"]["photoUrl"]

    assert client.get(photo_url).status_code == 401
    res = client.get(photo_url, headers=login("accountant"))
    assert res.status_code == 200
    assert res.data == PHOTO_BYTES


def test_timestamps_are_sent_with_a_utc_offset(client, login):
    # Regression: offset-less timestamps made the browser show times 5h30m early in IST.
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    assert bill["uploadedAt"].endswith("+00:00")


def test_accountant_can_flag_and_then_match_a_bill(client, login):
    bill_id = upload_bill(client, login("supervisor")).get_json()["delivery"]["id"]
    accountant = login("accountant")

    flagged = client.patch(
        f"/api/deliveries/{bill_id}",
        json={"ordered": 500, "delivered": 480, "note": "Short by 20 bags", "status": "REVIEW"},
        headers=accountant,
    )
    assert flagged.status_code == 200
    assert flagged.get_json()["delivery"]["status"] == "REVIEW"
    assert flagged.get_json()["delivery"]["note"] == "Short by 20 bags"

    matched = client.patch(f"/api/deliveries/{bill_id}", json={"ordered": 480, "status": "MATCHED"}, headers=accountant)
    assert matched.get_json()["delivery"]["status"] == "MATCHED"


def test_invalid_status_is_rejected(client, login):
    bill_id = upload_bill(client, login("supervisor")).get_json()["delivery"]["id"]
    res = client.patch(f"/api/deliveries/{bill_id}", json={"status": "DONE"}, headers=login("accountant"))
    assert res.status_code == 400


def test_matched_and_flagged_bills_stay_in_the_project_list(client, login):
    supervisor, accountant = login("supervisor"), login("accountant")
    ids = [upload_bill(client, supervisor).get_json()["delivery"]["id"] for _ in range(3)]
    client.patch(f"/api/deliveries/{ids[0]}", json={"status": "MATCHED"}, headers=accountant)
    client.patch(f"/api/deliveries/{ids[1]}", json={"status": "REVIEW"}, headers=accountant)

    bills = client.get("/api/projects/kh-014/deliveries", headers=accountant).get_json()["deliveries"]
    assert sorted(b["status"] for b in bills) == ["MATCHED", "PENDING", "REVIEW"]


def test_project_and_office_counts_split_by_status(client, login):
    supervisor, accountant = login("supervisor"), login("accountant")
    ids = [upload_bill(client, supervisor).get_json()["delivery"]["id"] for _ in range(4)]
    client.patch(f"/api/deliveries/{ids[0]}", json={"status": "MATCHED"}, headers=accountant)
    client.patch(f"/api/deliveries/{ids[1]}", json={"status": "REVIEW"}, headers=accountant)
    client.patch(f"/api/deliveries/{ids[2]}", json={"status": "REVIEW"}, headers=accountant)

    projects = client.get("/api/projects", headers=accountant).get_json()["projects"]
    kh014 = next(p for p in projects if p["id"] == "kh-014")
    assert (kh014["pendingCount"], kh014["flaggedCount"], kh014["matchedCount"]) == (1, 2, 1)
    other = next(p for p in projects if p["id"] == "kh-021")
    assert (other["pendingCount"], other["flaggedCount"], other["matchedCount"]) == (0, 0, 0)

    stats = client.get("/api/office/stats", headers=accountant).get_json()
    assert stats == {"pending": 1, "flagged": 2, "matchedThisMonth": 1}


def test_supervisor_today_view_only_shows_their_own_bills(client, login):
    upload_bill(client, login("supervisor"))
    upload_bill(client, login("admin"))

    res = client.get("/api/projects/kh-014/deliveries?uploadedByMe=1&today=1", headers=login("supervisor"))
    bills = res.get_json()["deliveries"]
    assert len(bills) == 1
    assert bills[0]["uploadedBy"] == "Ramesh Patil"


def test_supervisor_all_bills_view_includes_older_bills(client, app, login):
    from datetime import timedelta

    from siteverify.extensions import db
    from siteverify.models import Delivery

    supervisor = login("supervisor")
    old_id = upload_bill(client, supervisor).get_json()["delivery"]["id"]
    upload_bill(client, supervisor)
    with app.app_context():
        old = db.session.get(Delivery, old_id)
        old.uploaded_at -= timedelta(days=30)
        db.session.commit()

    all_bills = client.get("/api/projects/kh-014/deliveries?uploadedByMe=1", headers=supervisor).get_json()
    today = client.get("/api/projects/kh-014/deliveries?uploadedByMe=1&today=1", headers=supervisor).get_json()
    assert len(all_bills["deliveries"]) == 2
    assert all_bills["deliveries"][-1]["id"] == old_id  # newest first
    assert len(today["deliveries"]) == 1


def test_save_to_drive_without_a_connected_account_says_so(client, login):
    bill_id = upload_bill(client, login("supervisor")).get_json()["delivery"]["id"]
    res = client.post(f"/api/deliveries/{bill_id}/save-to-drive", headers=login("accountant"))
    assert res.status_code == 409
    assert "connect" in res.get_json()["error"].lower()
