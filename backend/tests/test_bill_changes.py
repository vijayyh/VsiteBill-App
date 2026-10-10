import json

import pytest

from siteverify import ocr
from test_deliveries import upload_bill
from test_ocr import CHALLAN, read

# The bill as CHALLAN reads (see test_ocr.py).
AS_READ = {
    "vendor": "SHREE GANESH BUILDING MATERIALS PVT LTD",
    "invoiceNumber": "1187",
    "billDate": "2026-10-02",
    "poNumber": "KH/PO/4471",
    "items": json.dumps([{"description": "OPC 53 Grade Cement 50kg", "quantity": 480, "unit": "Bags"}]),
}


@pytest.fixture
def vision_on(app, monkeypatch):
    app.config["GOOGLE_VISION_API_KEY"] = "test-key"
    monkeypatch.setattr(ocr, "_google_vision", lambda photo: CHALLAN)


def history(client, bill_id, headers):
    res = client.get(f"/api/deliveries/{bill_id}/changes", headers=headers)
    assert res.status_code == 200
    return res.get_json()["changes"]


def send_read_bill(client, headers, **changed):
    scan_id = read(client, headers).get_json()["scanId"]
    fields = {**AS_READ, **changed, "ocrScanId": str(scan_id)}
    return upload_bill(client, headers, **fields).get_json()["delivery"]


def test_a_bill_sent_as_the_photo_read_it_has_nothing_changed(client, login, vision_on):
    bill = send_read_bill(client, login("supervisor"))
    [sent] = history(client, bill["id"], login("accountant"))
    assert sent["action"] == "sent"
    assert sent["fromReading"] is True
    assert sent["changes"] == []
    assert sent["by"] == {"name": "Ramesh Patil", "role": "supervisor"}


def test_what_the_supervisor_changed_from_the_photo_is_recorded(client, login, vision_on):
    rows = [{"description": "OPC 53 Grade Cement 50kg", "quantity": 408, "unit": "Bags"}]
    bill = send_read_bill(
        client,
        login("supervisor"),
        vendor="Shree Ganesh Traders",
        poNumber="",
        items=json.dumps(rows),
        totalAmount="5000",  # the photo had no total: typed in, not changed
    )
    [sent] = history(client, bill["id"], login("admin"))
    assert sent["changes"] == [
        {"field": "vendor", "from": "SHREE GANESH BUILDING MATERIALS PVT LTD", "to": "Shree Ganesh Traders"},
        {"field": "poNumber", "from": "KH/PO/4471", "to": None},
        {"field": "items.1.quantity", "from": 480, "to": 408},
    ]


def test_a_bill_typed_in_without_a_reading_says_so(client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    [sent] = history(client, bill["id"], login("accountant"))
    assert sent["fromReading"] is False
    assert sent["changes"] == []


def test_every_office_save_is_recorded_with_each_value_from_and_to(client, login):
    rows = [{"description": "M-10", "quantity": 36.5, "unit": "CU.MT"}, {"description": "M-45", "quantity": 4.5}]
    bill = upload_bill(client, login("supervisor"), items=json.dumps(rows), totalAmount="711450").get_json()["delivery"]
    office = login("accountant")
    edited = [{"description": "M-10", "quantity": 30, "unit": "CU.MT"}, rows[1], {"description": "M-60", "quantity": 44.5}]
    client.patch(
        f"/api/deliveries/{bill['id']}",
        json={"items": edited, "totalAmount": "711,500", "status": "REVIEW", "note": "Short on M-10"},
        headers=office,
    )
    latest, sent = history(client, bill["id"], office)
    assert sent["action"] == "sent"
    assert latest["action"] == "edited"
    assert latest["by"] == {"name": "Priya Deshmukh", "role": "accountant"}
    assert latest["changes"] == [
        {"field": "items.1.quantity", "from": 36.5, "to": 30},
        {"field": "items.3", "from": None, "to": "M-60 · 44.5"},
        {"field": "totalAmount", "from": 711450, "to": 711500},
        {"field": "note", "from": None, "to": "Short on M-10"},
        {"field": "status", "from": "PENDING", "to": "REVIEW"},
    ]


def test_a_save_that_changes_nothing_adds_nothing(client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    office = login("accountant")
    client.patch(f"/api/deliveries/{bill['id']}", json={"vendor": "UltraTech Cement"}, headers=office)
    assert len(history(client, bill["id"], office)) == 1


def test_removing_an_item_is_recorded(client, login):
    rows = [{"description": "M-10", "quantity": 36.5, "unit": "CU.MT"}, {"description": "M-45", "quantity": 4.5}]
    bill = upload_bill(client, login("supervisor"), items=json.dumps(rows)).get_json()["delivery"]
    office = login("accountant")
    client.patch(f"/api/deliveries/{bill['id']}", json={"items": rows[:1]}, headers=office)
    assert history(client, bill["id"], office)[0]["changes"] == [{"field": "items.2", "from": "M-45 · 4.5", "to": None}]


def test_supervisors_cant_read_the_history(client, login):
    headers = login("supervisor")
    bill = upload_bill(client, headers).get_json()["delivery"]
    assert client.get(f"/api/deliveries/{bill['id']}/changes", headers=headers).status_code == 403


def test_history_of_a_missing_bill(client, login):
    assert client.get("/api/deliveries/999/changes", headers=login("admin")).status_code == 404


@pytest.mark.parametrize("value", ["1e5", "12abc", "₹10", "nan", "inf", "1.2.3", "0x10"])
def test_amounts_must_be_plain_numbers(client, login, value):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    office = login("accountant")
    for key in ("totalAmount", "ordered"):
        res = client.patch(f"/api/deliveries/{bill['id']}", json={key: value}, headers=office)
        assert res.status_code == 400, (key, value)
        assert "must be a number" in res.get_json()["error"]


def test_grouped_numbers_still_read(client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    res = client.patch(
        f"/api/deliveries/{bill['id']}", json={"totalAmount": "7,11,450.00", "ordered": "480"}, headers=login("accountant")
    )
    saved = res.get_json()["delivery"]
    assert saved["totalAmount"] == 711450 and saved["ordered"] == 480


def test_a_negative_amount_says_so(client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    res = client.patch(f"/api/deliveries/{bill['id']}", json={"cgst": "-5"}, headers=login("accountant"))
    assert res.status_code == 400
    assert "can't be negative" in res.get_json()["error"]
