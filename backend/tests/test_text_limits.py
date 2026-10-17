"""Text longer than its database column is cut to fit. Postgres (production) refuses over-long text
where SQLite (local, tests) doesn't, so without this a long bill worked locally and failed live:
a 17-item bill's item summary (455 characters) made reading it fail with a server error."""

from siteverify import ocr
from siteverify.extensions import db
from siteverify.models import Delivery, Notification, OcrScan
from test_deliveries import upload_bill
from test_ocr import read

LONG_VENDOR = "SHREE SIDDHI VINAYAK ELECTRICAL " * 10  # 320 characters
LONG_ITEMS = ", ".join(f"Polycab {n} Sqmm 3 Core Co Flexible Cable" for n in range(17))  # ~700


def test_a_reading_with_a_long_item_list_is_kept_cut_to_fit(app, client, login, monkeypatch):
    app.config["GOOGLE_VISION_API_KEY"] = "test-key"
    fields = {
        "vendor": {"value": LONG_VENDOR, "confidence": 0.9},
        "item": {"value": LONG_ITEMS, "confidence": 0.9},
        "poNumber": {"value": "PO-" + "9" * 80, "confidence": 0.9},
    }
    monkeypatch.setattr(ocr, "read_bill", lambda photo: ocr.Reading(provider="google", text="…", fields=fields))
    res = read(client, login("supervisor"))
    assert res.status_code == 200
    with app.app_context():
        scan = OcrScan.query.one()
        assert len(scan.vendor) == 200 and len(scan.item) == 300 and len(scan.po_number) == 50
        assert scan.reading["item"]["value"] == LONG_ITEMS  # the full reading is still kept


def test_a_bill_sent_with_a_long_vendor_and_po_is_cut_to_fit(app, client, login):
    res = upload_bill(client, login("supervisor"), vendor=LONG_VENDOR, poNumber="PO-" + "9" * 80)
    assert res.status_code == 201
    with app.app_context():
        bill = db.session.get(Delivery, res.get_json()["delivery"]["id"])
        assert len(bill.vendor) == 200 and len(bill.po_number) == 50


def test_editing_and_matching_with_a_long_vendor_is_cut_to_fit(app, client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    res = client.patch(
        f"/api/deliveries/{bill['id']}",
        json={"vendor": LONG_VENDOR, "poNumber": "PO-" + "9" * 80, "item": LONG_ITEMS, "status": "MATCHED", "ordered": 480},
        headers=login("accountant"),
    )
    assert res.status_code == 200
    with app.app_context():
        saved = db.session.get(Delivery, bill["id"])
        assert len(saved.vendor) == 200 and len(saved.po_number) == 50 and len(saved.item) <= 300
        assert all(len(n.title) <= 200 and len(n.body or "") <= 300 for n in Notification.query.all())
