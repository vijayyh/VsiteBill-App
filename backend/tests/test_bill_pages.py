"""Bills photographed in several pages: sending them, reading them as one bill, archiving them."""

import io

import pytest

from siteverify import drive, ocr
from siteverify.extensions import db
from siteverify.models import Delivery, OcrScan
from siteverify.ocr import parse_pages

from test_deliveries import upload_bill
from test_ocr import CHALLAN, cell, page, read, value
from test_office_drive import connect_fake_drive


def pages_form(*names, **fields):
    """The bill form with one "photo" part per page, in order."""
    return {"photo": [(io.BytesIO(f"page {name}".encode()), f"{name}.jpg") for name in names], **fields}


def send_pages(client, headers, *names, **fields):
    data = {"vendor": "UltraTech Cement", "item": "OPC 53", "delivered": "480", **pages_form(*names), **fields}
    return client.post("/api/projects/kh-014/deliveries", data=data, headers=headers, content_type="multipart/form-data")


def stored_bytes(app, url):
    with app.app_context():
        return (app.config["UPLOAD_DIR"] / url.rsplit("/", 1)[-1]).read_bytes()


# ── Sending ────────────────────────────────────────────────────────────────────────────────────


def test_a_bill_sent_in_three_pages_keeps_them_in_order(app, client, login):
    res = send_pages(client, login("supervisor"), "one", "two", "three")
    assert res.status_code == 201
    bill = res.get_json()["delivery"]
    assert len(bill["photoUrls"]) == 3
    assert bill["photoUrl"] == bill["photoUrls"][0]
    assert [stored_bytes(app, url) for url in bill["photoUrls"]] == [b"page one", b"page two", b"page three"]
    with app.app_context():
        assert Delivery.query.count() == 1  # one bill, not one per page


def test_a_one_photo_bill_is_sent_as_before(client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    assert bill["photoUrls"] == [bill["photoUrl"]]


def test_every_page_of_a_bill_can_be_viewed(client, login):
    headers = login("supervisor")
    bill = send_pages(client, headers, "one", "two").get_json()["delivery"]
    for url in bill["photoUrls"]:
        assert client.get(url, headers=headers).status_code == 200
    assert client.get(f"/api/deliveries/{bill['id']}", headers=login("accountant")).get_json()["delivery"]["photoUrls"] == bill["photoUrls"]


def test_too_many_pages_are_refused(client, login):
    res = send_pages(client, login("supervisor"), *[str(n) for n in range(11)])
    assert res.status_code == 400


def test_a_bill_sent_before_pages_existed_still_has_its_one_photo(app, client, login):
    bill = upload_bill(client, login("supervisor")).get_json()["delivery"]
    with app.app_context():
        # As the migration leaves a bill made before it: page 1 only, and an empty list after it.
        delivery = db.session.get(Delivery, bill["id"])
        assert delivery.more_photo_filenames == []
        assert delivery.photo_filenames() == [delivery.photo_filename]


# ── Reading ────────────────────────────────────────────────────────────────────────────────────

FIRST_PAGE = page(
    cell(40, 30, "Balaji Hardware & Sons", h=24),
    cell(40, 80, "Invoice No: BH-2207"),
    cell(400, 80, "Date: 12/10/2026"),
    cell(40, 100, "PO No: KH/PO/5120"),
    cell(40, 160, "Description"),
    cell(300, 160, "Qty"),
    cell(380, 160, "Rate"),
    cell(470, 160, "Amount"),
    cell(40, 185, "GI Wire 18 gauge"),
    cell(300, 185, "25"),
    cell(380, 185, "100.00"),
    cell(470, 185, "2,500.00"),
)
SECOND_PAGE = page(
    cell(40, 30, "Page 2"),
    cell(40, 160, "Description"),
    cell(300, 160, "Qty"),
    cell(380, 160, "Rate"),
    cell(470, 160, "Amount"),
    cell(40, 185, "Binding Wire"),
    cell(300, 185, "10"),
    cell(380, 185, "50.00"),
    cell(470, 185, "500.00"),
    cell(40, 215, "Total"),
    cell(300, 215, "10"),
    cell(470, 215, "500.00"),
    cell(300, 260, "Taxable Value"),
    cell(470, 260, "3,000.00"),
    cell(300, 280, "CGST @ 9%"),
    cell(470, 280, "270.00"),
    cell(300, 300, "SGST @ 9%"),
    cell(470, 300, "270.00"),
    cell(300, 320, "Grand Total"),
    cell(470, 320, "3,540.00"),
)


def descriptions(fields):
    return [row["description"] for row in value(fields, "items")]


def test_two_pages_read_as_one_bill(app):
    with app.app_context():
        fields = parse_pages([FIRST_PAGE, SECOND_PAGE])
    # The heading of the bill from page 1, the goods of both pages in order, the totals from the end.
    assert value(fields, "vendor") == "Balaji Hardware & Sons"
    assert value(fields, "invoiceNumber") == "BH-2207"
    assert value(fields, "poNumber") == "KH/PO/5120"
    assert descriptions(fields) == ["GI Wire 18 gauge", "Binding Wire"]
    assert value(fields, "delivered") == 35
    assert value(fields, "item") == "GI Wire 18 gauge, Binding Wire"
    assert value(fields, "taxableAmount") == 3000
    assert value(fields, "cgst") == 270
    assert value(fields, "totalAmount") == 3540


def test_page_order_is_kept(app):
    with app.app_context():
        fields = parse_pages([SECOND_PAGE, FIRST_PAGE])
    assert descriptions(fields) == ["Binding Wire", "GI Wire 18 gauge"]


def test_one_page_reads_exactly_as_before(app):
    with app.app_context():
        assert parse_pages([FIRST_PAGE]) == ocr.parse_page(FIRST_PAGE)


def test_pages_with_no_printed_totals_get_them_worked_out_from_every_page(app):
    no_totals = page(*SECOND_PAGE.lines[:12])  # page 2 up to its goods table's Total row
    with app.app_context():
        fields = parse_pages([FIRST_PAGE, no_totals])
    # Not one page's share: every page's rows added up, and the total marked for checking.
    assert value(fields, "taxableAmount") == 3000
    assert value(fields, "totalAmount") == 3000
    assert fields["totalAmount"]["confidence"] < ocr.LOW_CONFIDENCE


def read_pages(client, headers, *names):
    return client.post("/api/ocr/bill", data=pages_form(*names), headers=headers, content_type="multipart/form-data")


@pytest.fixture
def vision_pages(app, monkeypatch):
    """Reading switched on; each page photo b"page <name>" reads as PAGES[name] (or fails)."""
    app.config["GOOGLE_VISION_API_KEY"] = "test-key"
    pages = {b"page one": FIRST_PAGE, b"page two": SECOND_PAGE, b"page bad": ocr.OcrError("unreadable image")}
    calls = []

    def fake(photos):
        calls.append(len(photos))
        return [pages[photo] for photo in photos]

    monkeypatch.setattr(ocr, "_google_vision_pages", fake)
    return calls


def test_every_page_is_read_in_one_request_and_kept_as_one_reading(app, client, login, vision_pages):
    res = read_pages(client, login("supervisor"), "one", "two")
    assert res.status_code == 200
    body = res.get_json()
    assert body["failedPages"] == []
    assert value(body["fields"], "totalAmount") == 3540
    assert descriptions(body["fields"]) == ["GI Wire 18 gauge", "Binding Wire"]
    assert vision_pages == [2]
    with app.app_context():
        scan = db.session.get(OcrScan, body["scanId"])
        assert scan.pages == 2
        assert "--- Page 2 ---" in scan.text


def test_a_page_that_cant_be_read_is_reported_not_hidden(app, client, login, vision_pages):
    body = read_pages(client, login("supervisor"), "one", "bad").get_json()
    assert body["failedPages"] == [2]
    assert descriptions(body["fields"]) == ["GI Wire 18 gauge"]
    with app.app_context():
        assert db.session.get(OcrScan, body["scanId"]).pages == 1  # only the page read is charged for


def test_no_page_read_tells_the_form_to_carry_on(app, client, login, vision_pages):
    res = read_pages(client, login("supervisor"), "bad", "bad")
    assert res.status_code == 502
    with app.app_context():
        assert OcrScan.query.count() == 0


def test_one_photo_is_still_read_as_before(client, login, monkeypatch, app):
    app.config["GOOGLE_VISION_API_KEY"] = "test-key"
    monkeypatch.setattr(ocr, "_google_vision", lambda photo: CHALLAN)
    body = read(client, login("supervisor")).get_json()
    assert body["failedPages"] == []
    assert value(body["fields"], "vendor") == "SHREE GANESH BUILDING MATERIALS PVT LTD"


def test_the_monthly_limit_counts_pages(app, client, login, vision_pages):
    app.config["OCR_MONTHLY_LIMIT"] = 3
    headers = login("supervisor")
    assert read_pages(client, headers, "one", "two").status_code == 200
    # 2 of 3 used: two more pages would go over, so nothing is read (or charged).
    assert read_pages(client, headers, "one", "two").status_code == 503
    assert vision_pages == [2]
    assert read_pages(client, headers, "one").status_code == 200


def test_the_reading_attaches_once_to_the_bill_sent_with_every_page(app, client, login, vision_pages):
    headers = login("supervisor")
    scan_id = read_pages(client, headers, "one", "two").get_json()["scanId"]
    first = send_pages(client, headers, "one", "two", ocrScanId=str(scan_id)).get_json()["delivery"]
    # A retry sending the same reading again doesn't attach it to a second bill.
    send_pages(client, headers, "one", "two", ocrScanId=str(scan_id))
    with app.app_context():
        assert db.session.get(OcrScan, scan_id).delivery_id == first["id"]


def test_vision_batches_stay_under_its_request_limit(app, monkeypatch):
    sent = []
    monkeypatch.setattr(ocr, "_vision_request", lambda photos: sent.append(len(photos)) or [CHALLAN] * len(photos))
    big = b"x" * (3 * 1024 * 1024)
    with app.app_context():
        pages = ocr._google_vision_pages([big, big, big])
    assert len(pages) == 3
    assert sent == [2, 1]


# ── Archiving to Drive ─────────────────────────────────────────────────────────────────────────


class FakeDrive:
    def __init__(self):
        self.created = []

    def files(self):
        return self

    def create(self, body, media_body, fields, supportsAllDrives):
        self.created.append((body["name"], media_body.getbytes(0, 100)))
        return self

    def execute(self):
        return {"id": f"file{len(self.created)}", "webViewLink": "https://drive.example/file"}


def test_every_page_is_saved_to_drive_next_to_the_bill(app, client, login, monkeypatch):
    connect_fake_drive(app)
    fake = FakeDrive()
    monkeypatch.setattr(drive, "_service", lambda: fake)
    monkeypatch.setattr(drive, "_ensure_project_folder", lambda service, account, project: "folder014")
    bill = send_pages(client, login("supervisor"), "one", "two", "three").get_json()["delivery"]

    res = client.post(f"/api/deliveries/{bill['id']}/save-to-drive", headers=login("accountant"))
    assert res.status_code == 200
    names = [name for name, _ in fake.created]
    assert names[0].endswith(".jpg") and names[1:] == [names[0][:-4] + "-p2.jpg", names[0][:-4] + "-p3.jpg"]
    assert [data for _, data in fake.created] == [b"page one", b"page two", b"page three"]
    assert res.get_json()["delivery"]["driveFileId"] == "file1"  # the bill links to page 1, as before
