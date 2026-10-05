"""Who may see and change which bills, and validation of review edits."""
import pytest

from tests.test_deliveries import upload_bill


@pytest.fixture
def second_supervisor(client, login):
    """Headers for a second supervisor, created by the admin."""
    res = client.post(
        "/api/admin/users",
        json={"name": "Suresh Kale", "phone": "+91 98200 00077", "role": "supervisor"},
        headers=login("admin"),
    )
    password = res.get_json()["temporaryPassword"]
    token = client.post("/api/auth/login", json={"phone": "+91 98200 00077", "password": password}).get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_supervisor_cannot_review_their_own_bill(client, login):
    supervisor = login("supervisor")
    bill_id = upload_bill(client, supervisor).get_json()["delivery"]["id"]

    res = client.patch(f"/api/deliveries/{bill_id}", json={"status": "MATCHED"}, headers=supervisor)
    assert res.status_code == 403
    bill = client.get(f"/api/deliveries/{bill_id}", headers=login("accountant")).get_json()["delivery"]
    assert bill["status"] == "PENDING"


def test_supervisor_cannot_see_or_edit_another_supervisors_bill(client, login, second_supervisor):
    other_bill = upload_bill(client, second_supervisor, vendor="Other site vendor").get_json()["delivery"]["id"]
    supervisor = login("supervisor")

    assert client.get(f"/api/deliveries/{other_bill}", headers=supervisor).status_code == 404
    assert client.patch(f"/api/deliveries/{other_bill}", json={"vendor": "x"}, headers=supervisor).status_code == 403
    # The project list hides it too, even without ?uploadedByMe=1.
    listed = client.get("/api/projects/kh-014/deliveries", headers=supervisor).get_json()["deliveries"]
    assert other_bill not in [b["id"] for b in listed]


def test_supervisor_can_still_open_their_own_bill(client, login):
    supervisor = login("supervisor")
    bill_id = upload_bill(client, supervisor).get_json()["delivery"]["id"]
    assert client.get(f"/api/deliveries/{bill_id}", headers=supervisor).status_code == 200


def test_office_still_sees_every_supervisors_bills(client, login, second_supervisor):
    upload_bill(client, login("supervisor"))
    upload_bill(client, second_supervisor)
    for role in ("accountant", "admin"):
        listed = client.get("/api/projects/kh-014/deliveries", headers=login(role)).get_json()["deliveries"]
        assert len(listed) == 2


def test_supervisor_cannot_save_to_drive(client, login):
    supervisor = login("supervisor")
    bill_id = upload_bill(client, supervisor).get_json()["delivery"]["id"]
    assert client.post(f"/api/deliveries/{bill_id}/save-to-drive", headers=supervisor).status_code == 403


@pytest.mark.parametrize("bad", ["abc", [1], {"n": 1}, True, -5])
def test_review_rejects_quantities_that_are_not_numbers(client, login, bad):
    bill_id = upload_bill(client, login("supervisor")).get_json()["delivery"]["id"]
    accountant = login("accountant")

    res = client.patch(f"/api/deliveries/{bill_id}", json={"ordered": bad, "vendor": "Changed"}, headers=accountant)
    assert res.status_code == 400
    # Nothing in the request was applied.
    bill = client.get(f"/api/deliveries/{bill_id}", headers=accountant).get_json()["delivery"]
    assert bill["vendor"] == "UltraTech Cement"
    assert bill["ordered"] is None


def test_review_accepts_numeric_strings_and_clearing(client, login):
    bill_id = upload_bill(client, login("supervisor")).get_json()["delivery"]["id"]
    accountant = login("accountant")

    bill = client.patch(f"/api/deliveries/{bill_id}", json={"ordered": "500"}, headers=accountant).get_json()["delivery"]
    assert bill["ordered"] == 500
    bill = client.patch(f"/api/deliveries/{bill_id}", json={"ordered": None}, headers=accountant).get_json()["delivery"]
    assert bill["ordered"] is None


def test_review_rejects_non_text_fields(client, login):
    bill_id = upload_bill(client, login("supervisor")).get_json()["delivery"]["id"]
    res = client.patch(f"/api/deliveries/{bill_id}", json={"vendor": 42}, headers=login("accountant"))
    assert res.status_code == 400
