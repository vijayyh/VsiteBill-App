import io
import math

import pytest

from siteverify import ocr
from siteverify.extensions import db
from siteverify.models import OcrScan
from siteverify.ocr import Line, Page, Word, page_from_vision, parse_page

from test_deliveries import upload_bill


# ── Building pages of positioned words, the way a reader returns them ───────────────────────────


def cell(x, y, text, h=12, conf=0.98):
    """One run of text starting at (x, y): a Line of Words, each roughly as wide as its letters."""
    words, cursor = [], x
    for token in text.split():
        width = len(token) * 0.6 * h
        words.append(Word(token, conf, cursor, y, cursor + width, y + h))
        cursor += width + 0.4 * h
    return Line(words)


def page(*cells):
    return Page(lines=list(cells), text="\n".join(c.text for c in cells))


def value(fields, key):
    return fields[key]["value"] if fields[key] else None


# A typical printed delivery challan: seller's name at the top, the buyer's block, references on
# the right, a goods table, and the seller's signature line at the foot.
CHALLAN = page(
    cell(40, 30, "SHREE GANESH BUILDING MATERIALS PVT LTD", h=26),
    cell(40, 70, "Plot 12, MIDC Bhiwandi, Thane 421302"),
    cell(40, 90, "GSTIN: 27AABCS1234F1Z5 Ph: 9876543210"),
    cell(260, 125, "DELIVERY CHALLAN", h=18),
    cell(40, 170, "To, M/s KH Group"),
    cell(40, 190, "Andheri Metro Depot, Phase 2"),
    cell(520, 170, "Challan No: 1187"),
    cell(520, 190, "P.O. No: KH/PO/4471"),
    cell(520, 210, "Date: 02/10/2026"),
    cell(40, 270, "Sr"),
    cell(100, 270, "Description of Goods"),
    cell(420, 270, "HSN"),
    cell(520, 270, "Qty"),
    cell(600, 270, "Unit"),
    cell(40, 300, "1"),
    cell(100, 300, "OPC 53 Grade Cement 50kg"),
    cell(420, 300, "2523"),
    cell(520, 300, "480"),
    cell(600, 300, "Bags"),
    cell(100, 340, "Total"),
    cell(520, 340, "480"),
    cell(440, 520, "For Shree Ganesh Building Materials Pvt Ltd"),
    cell(470, 570, "Authorised Signatory"),
)


def rows(fields):
    """The goods rows as read, without their confidences."""
    return [{k: v for k, v in row.items() if k != "confidence"} for row in value(fields, "items") or []]


def test_reads_a_challan_with_a_goods_table(app):
    with app.app_context():
        fields = parse_page(CHALLAN)
    assert value(fields, "vendor") == "SHREE GANESH BUILDING MATERIALS PVT LTD"
    assert value(fields, "invoiceNumber") == "1187"
    assert value(fields, "billDate") == "2026-10-02"
    assert value(fields, "poNumber") == "KH/PO/4471"
    assert rows(fields) == [
        {"description": "OPC 53 Grade Cement 50kg", "quantity": 480, "unit": "Bags", "rate": None, "amount": None}
    ]
    assert value(fields, "item") == "OPC 53 Grade Cement 50kg"
    assert value(fields, "delivered") == 480
    # A challan carries no prices.
    assert all(fields[k] is None for k in ("taxableAmount", "cgst", "sgst", "igst", "totalAmount"))
    assert all(fields[k]["confidence"] >= ocr.LOW_CONFIDENCE for k in fields if fields[k])


def acme_invoice(printed_total="85.50"):
    # Laid out like a real ready-mix tax invoice (names made up): shortened logo over the full name
    # in the signature, a Sr. No. column, three grades, a Total row, an empty PO No. box, and the
    # taxes and grand total under the table.
    return page(
        cell(360, 68, "ACME MIX", h=28),
        cell(367, 95, "CONCRETE", h=19),
        cell(89, 227, "GSTN NO : 27ABCDE1234F1Z5"),
        cell(353, 276, "TAX-INVOICE", h=16),
        cell(94, 308, "To,"),
        cell(94, 323, "SUSTANIQ CIVILCON LLP"),
        cell(545, 380, "Invoice No."),
        cell(545, 400, "MRL/26-27/158"),
        cell(726, 380, "Dated"),
        cell(726, 400, "31-Aug-26"),
        cell(545, 421, "PO No."),
        cell(726, 424, "PO Date"),
        cell(718, 447, "16/08/2026"),
        cell(76, 499, "Sr. No."),
        cell(122, 499, "Description of Goods"),
        cell(403, 502, "HSN Code"),
        cell(527, 504, "Quantity"),
        cell(605, 504, "Unit"),
        cell(690, 507, "Rate"),
        cell(778, 507, "Amount"),
        cell(89, 535, "1"),
        cell(122, 534, "M-10"),
        cell(395, 533, "38245010"),
        cell(529, 534, "36.50"),
        cell(605, 534, "CU.MT"),
        cell(676, 538, "5063.56"),
        cell(770, 538, "184819.94"),
        cell(88, 556, "2"),
        cell(122, 556, "M-45"),
        cell(535, 554, "4.50"),
        cell(605, 556, "CU.MT"),
        cell(676, 558, "7012.71"),
        cell(776, 558, "31557.20"),
        cell(87, 576, "3"),
        cell(122, 576, "M-60"),
        cell(528, 578, "44.50"),
        cell(605, 578, "CU.MT"),
        cell(676, 580, "8686.44"),
        cell(770, 580, "386546.58"),
        cell(421, 713, "Total"),
        cell(525, 715, printed_total),
        cell(770, 715, "602923.72"),
        cell(560, 760, "CGST 9.00 %"),
        cell(776, 760, "54263.13"),
        cell(560, 780, "SGST 9.00 %"),
        cell(776, 780, "54263.13"),
        cell(560, 800, "Round off"),
        cell(800, 800, "0.02"),
        cell(560, 830, "Grand Total"),
        cell(770, 830, "711450.00"),
        cell(640, 1021, "For ACME MIX CONCRETE"),
        cell(708, 1172, "Authorised Signatory"),
    )


def test_a_bill_with_several_items_gives_every_row_and_the_amounts(app):
    with app.app_context():
        fields = parse_page(acme_invoice())
    assert value(fields, "vendor") == "ACME MIX CONCRETE"
    assert value(fields, "invoiceNumber") == "MRL/26-27/158"
    assert value(fields, "billDate") == "2026-08-31"
    assert value(fields, "poNumber") is None  # the PO box is printed but empty
    assert rows(fields) == [
        {"description": "M-10", "quantity": 36.5, "unit": "CU.MT", "rate": 5063.56, "amount": 184819.94},
        {"description": "M-45", "quantity": 4.5, "unit": "CU.MT", "rate": 7012.71, "amount": 31557.2},
        {"description": "M-60", "quantity": 44.5, "unit": "CU.MT", "rate": 8686.44, "amount": 386546.58},
    ]
    assert value(fields, "item") == "M-10, M-45, M-60"
    assert value(fields, "delivered") == 85.5
    assert value(fields, "taxableAmount") == 602923.72
    assert value(fields, "cgst") == value(fields, "sgst") == 54263.13
    assert value(fields, "igst") is None
    assert value(fields, "totalAmount") == 711450
    assert all(fields[k]["confidence"] >= ocr.LOW_CONFIDENCE for k in fields if fields[k])


def test_rows_that_dont_add_up_to_the_printed_total_are_worth_a_second_look(app):
    with app.app_context():
        fields = parse_page(acme_invoice(printed_total="95.50"))
    assert value(fields, "delivered") == 85.5
    assert fields["delivered"]["confidence"] < ocr.LOW_CONFIDENCE


def test_reads_an_online_store_invoice(app):
    # Laid out like a real online-store invoice (names made up): "Sold By", the store's own order
    # number beside our PO number, headings stacked over two lines with columns as close together
    # as words, a description over three lines with the numbers on its middle one, the tax as
    # columns of the table, and a Total row whose two amounts the reader ran together.
    bill = page(
        cell(50, 40, "Tax Invoice/Bill of Supply/Cash Memo", h=18),
        cell(50, 200, "Sold By :"),
        cell(50, 220, "Brickmart.in"),
        cell(50, 240, "Unit 4, Sector 18, Gurugram"),
        cell(600, 200, "Billing Address :"),
        cell(600, 220, "SUSTANIQ CIVILCON LLP"),
        cell(50, 400, "Order Number: 404-1234567-7654321"),
        cell(50, 420, "Order Date: 02.08.2025"),
        cell(600, 400, "PO Number: 2025/7"),
        cell(600, 420, "Invoice Number : IN-302"),
        cell(600, 440, "Invoice Date : 04.08.2025"),
        cell(51, 858, "SI.", h=16),
        cell(51, 878, "No", h=16),
        cell(79, 869, "Description", h=16),
        cell(600, 858, "Unit", h=16),
        cell(600, 878, "Price", h=16),
        cell(663, 869, "Qty", h=16),
        cell(693, 858, "Net", h=16),
        cell(694, 880, "Amount", h=16),
        cell(774, 858, "Tax", h=16),
        cell(774, 880, "Rate", h=16),
        cell(815, 858, "Tax", h=16),
        cell(815, 880, "Type", h=16),
        cell(859, 858, "Tax", h=16),
        cell(859, 880, "Amount", h=16),
        cell(927, 858, "Total", h=16),
        cell(927, 880, "Amount", h=16),
        cell(59, 905, "1 Brickmart Curing Compound for Concrete | 20L Drum", h=14),
        cell(79, 925, "Membrane Cure | Easy Spray I Saves Water & Prevents Cracks", h=14),
        cell(598, 933, "R590.00", h=16),
        cell(670, 933, "3", h=16),
        cell(693, 933, "R1,770.00", h=16),
        cell(777, 933, "18%", h=16),
        cell(817, 933, "IGST", h=16),
        cell(860, 933, "318.60", h=16),
        cell(930, 933, "2,088.60", h=16),
        cell(79, 945, "(20 Litre X 1 Drum) I BMCC20L (1PC-Cure)", h=14),
        cell(79, 962, "HSN:3824", h=14),
        cell(51, 991, "TOTAL:", h=16),
        cell(861, 993, "R318.602.088.60", h=16),
        cell(50, 1029, "Amount in Words:"),
        cell(800, 1092, "For Brickmart.in:"),
        cell(791, 1178, "Authorized Signatory"),
    )
    with app.app_context():
        fields = parse_page(bill)
    assert value(fields, "vendor") == "Brickmart.in"
    assert value(fields, "poNumber") == "2025/7"
    assert value(fields, "invoiceNumber") == "IN-302"
    assert value(fields, "billDate") == "2025-08-04"
    assert rows(fields) == [
        {
            "description": "Brickmart Curing Compound for Concrete | 20L Drum Membrane Cure | Easy Spray I Saves "
            "Water & Prevents Cracks (20 Litre X 1 Drum) I BMCC20L (1PC-Cure)",
            "quantity": 3,
            "unit": None,
            "rate": 590,
            "amount": 1770,
        }
    ]
    assert value(fields, "delivered") == 3
    assert value(fields, "taxableAmount") == 1770
    assert value(fields, "igst") == 318.6
    assert value(fields, "cgst") is None and value(fields, "sgst") is None
    # The run-together Total row can't be read, so the total comes from the row; it adds up.
    assert value(fields, "totalAmount") == 2088.6
    assert fields["totalAmount"]["confidence"] >= ocr.LOW_CONFIDENCE


def test_amounts_that_dont_add_up_keep_their_own_confidence(app):
    bill = page(
        cell(40, 30, "Balaji Hardware & Sons", h=24),
        cell(40, 100, "Material: GI Wire 18 gauge"),
        cell(40, 120, "Quantity: 25 Kgs"),
        cell(300, 200, "Taxable Value"),
        cell(500, 200, "2,500.00", conf=0.7),
        cell(300, 220, "CGST @ 9%"),
        cell(500, 220, "225.00"),
        cell(300, 240, "SGST @ 9%"),
        cell(500, 240, "225.00"),
        cell(300, 260, "Grand Total"),
        cell(500, 260, "2,960.00"),  # 2,500 + 450 is 2,950: one of them was misread
    )
    with app.app_context():
        fields = parse_page(bill)
    assert rows(fields) == [{"description": "GI Wire 18 gauge", "quantity": 25, "unit": "Kgs", "rate": None, "amount": None}]
    assert value(fields, "taxableAmount") == 2500
    assert value(fields, "totalAmount") == 2960
    assert fields["taxableAmount"]["confidence"] < ocr.LOW_CONFIDENCE


def test_a_buyers_order_number_is_the_po_when_no_po_box_is_printed(app):
    bill = page(cell(40, 30, "Buyer's Order No. 4471"), cell(40, 50, "Order Date: 02/10/2026"))
    with app.app_context():
        fields = parse_page(bill)
    assert value(fields, "poNumber") == "4471"
    assert value(fields, "billDate") is None  # the order's date, not the bill's


def test_reads_a_simple_bill_from_labels(app):
    bill = page(
        cell(40, 30, "Om Sai Sand Suppliers", h=24),
        cell(40, 70, "Near Station Road, Kalyan"),
        cell(40, 120, "Material: River Sand"),
        cell(40, 140, "Quantity: 3 Brass"),
        cell(40, 160, "PO Ref - 4500012345"),
        cell(40, 180, "Vehicle No: MH05 AB 1234"),
    )
    with app.app_context():
        fields = parse_page(bill)
    assert value(fields, "vendor") == "Om Sai Sand Suppliers"
    assert value(fields, "item") == "River Sand"
    assert value(fields, "delivered") == 3
    assert value(fields, "poNumber") == "4500012345"


def test_handles_indian_number_grouping_and_a_quantity_with_its_unit(app):
    bill = page(
        cell(40, 30, "Metro Steels", h=24),
        cell(40, 120, "TMT Fe500 12mm 1,250.5 Kgs"),
    )
    with app.app_context():
        fields = parse_page(bill)
    assert value(fields, "delivered") == 1250.5
    # Read from a bare "1,250.5 Kgs" rather than a labelled column: marked for a second look.
    assert fields["delivered"]["confidence"] < ocr.LOW_CONFIDENCE


def test_never_takes_the_buyer_for_the_vendor(app):
    bill = page(
        cell(40, 30, "KH GROUP", h=30),  # the buyer, printed large on their own PO form
        cell(40, 70, "Balaji Hardware & Sons", h=20),
        cell(40, 150, "Qty: 20"),
    )
    with app.app_context():
        fields = parse_page(bill)
    assert value(fields, "vendor") == "Balaji Hardware & Sons"


def test_a_po_date_is_not_read_as_the_po_number(app):
    bill = page(cell(40, 30, "PO Date: 02/10/2026"), cell(40, 50, "Purchase Order No. 7781/B"))
    with app.app_context():
        assert value(parse_page(bill), "poNumber") == "7781/B"


def test_low_confidence_words_lower_the_field_confidence(app):
    blurry = page(
        cell(40, 30, "Ganesh Traders", h=24),
        cell(100, 100, "Description"),
        cell(400, 100, "Qty"),
        cell(100, 130, "Fly Ash Bricks"),
        cell(400, 130, "4800", conf=0.55),
    )
    with app.app_context():
        fields = parse_page(blurry)
    assert value(fields, "delivered") == 4800
    assert fields["delivered"]["confidence"] < ocr.LOW_CONFIDENCE


def test_a_blank_photo_reads_nothing(app):
    with app.app_context():
        assert parse_page(Page()) == dict.fromkeys(ocr.FIELD_NAMES)


def vision_word(text, x, y, w, h, angle=0.0, ends="LINE_BREAK"):
    """A word as Vision returns it: corners from the text's own top-left, in image pixels, and the
    break after it (None when the next word follows with no space, as with "KH/PO")."""
    corners = [(0, 0), (w, 0), (w, h), (0, h)]
    cos, sin = math.cos(angle), math.sin(angle)
    vertices = [{"x": round(x + cx * cos - cy * sin), "y": round(y + cx * sin + cy * cos)} for cx, cy in corners]
    symbols = [{"text": c} for c in text]
    if ends:
        symbols[-1]["property"] = {"detectedBreak": {"type": ends}}
    return {"boundingBox": {"vertices": vertices}, "symbols": symbols, "confidence": 0.97}


def test_punctuation_vision_returns_as_separate_words_is_joined_back(app):
    # Vision reads "P.O. No: KH/PO/4471" as P.O. | No | : | KH | / | PO | / | 4471.
    parts = [("P.O.", "SPACE"), ("No", None), (":", "SPACE"), ("KH", None), ("/", None), ("PO", None), ("/", None), ("4471", "LINE_BREAK")]
    words = [vision_word(text, 40 + i * 30, 50, 28, 12, ends=ends) for i, (text, ends) in enumerate(parts)]
    annotation = {"text": "P.O. No: KH/PO/4471", "pages": [{"blocks": [{"paragraphs": [{"words": words}]}]}]}
    result = page_from_vision(annotation)
    assert result.lines[0].text == "P.O. No: KH/PO/4471"
    with app.app_context():
        assert value(parse_page(result), "poNumber") == "KH/PO/4471"


def test_a_photo_taken_sideways_is_read_upright():
    # Text running down the image (the phone was held sideways): "Qty" above "480" on the page
    # becomes "Qty" to the right of "480" in the image.
    angle = math.pi / 2
    words = [vision_word("Qty", 500, 100, 36, 12, angle), vision_word("480", 470, 100, 36, 12, angle)]
    annotation = {"text": "Qty\n480", "pages": [{"blocks": [{"paragraphs": [{"words": words}]}]}]}
    result = page_from_vision(annotation)
    qty, number = result.words
    assert number.cy > qty.cy  # 480 is below Qty once straightened
    assert abs(number.cx - qty.cx) < 5


# ── The endpoint and linking a reading to the bill ──────────────────────────────────────────────

PHOTO = b"\xff\xd8\xff fake jpeg bytes"


@pytest.fixture
def vision_on(app, monkeypatch):
    """OCR switched on, with the reading service replaced by CHALLAN (no network call)."""
    app.config["GOOGLE_VISION_API_KEY"] = "test-key"
    monkeypatch.setattr(ocr, "_google_vision", lambda photo: CHALLAN)


def read(client, headers, photo=PHOTO):
    return client.post(
        "/api/ocr/bill",
        data={"photo": (io.BytesIO(photo), "bill.jpg")},
        headers=headers,
        content_type="multipart/form-data",
    )


def test_reading_is_off_without_an_api_key(client, login):
    headers = login("supervisor")
    assert client.get("/api/ocr/status", headers=headers).get_json() == {"enabled": False}
    assert read(client, headers).status_code == 503


def test_reading_needs_a_login(client, vision_on):
    assert read(client, {}).status_code == 401


def test_supervisor_gets_the_fields_and_the_reading_is_kept(app, client, login, vision_on):
    res = read(client, login("supervisor"))
    assert res.status_code == 200
    body = res.get_json()
    assert body["fields"]["vendor"]["value"] == "SHREE GANESH BUILDING MATERIALS PVT LTD"
    assert body["fields"]["delivered"]["value"] == 480
    assert body["fields"]["items"]["value"][0]["unit"] == "Bags"
    with app.app_context():
        scan = db.session.get(OcrScan, body["scanId"])
        assert scan.po_number == "KH/PO/4471"
        assert scan.delivery_id is None
        assert "DELIVERY CHALLAN" in scan.text


def test_reading_without_a_photo_is_rejected(client, login, vision_on):
    res = client.post("/api/ocr/bill", data={}, headers=login("supervisor"), content_type="multipart/form-data")
    assert res.status_code == 400


def test_a_failed_reading_tells_the_form_to_carry_on(app, client, login, monkeypatch):
    app.config["GOOGLE_VISION_API_KEY"] = "test-key"

    def fail(photo):
        raise ocr.OcrError("quota exceeded")

    monkeypatch.setattr(ocr, "_google_vision", fail)
    res = read(client, login("supervisor"))
    assert res.status_code == 502
    assert "Type the details in" in res.get_json()["error"]


def test_sending_the_bill_links_the_reading_to_it(app, client, login, vision_on):
    headers = login("supervisor")
    scan_id = read(client, headers).get_json()["scanId"]
    bill = upload_bill(client, headers, delivered="480", ocrScanId=str(scan_id)).get_json()["delivery"]
    with app.app_context():
        assert db.session.get(OcrScan, scan_id).delivery_id == bill["id"]
    assert bill["quantityLowConfidence"] is False  # read clearly


def test_an_uncertain_quantity_kept_as_read_asks_the_office_to_double_check(app, client, login, vision_on):
    headers = login("supervisor")
    scan_id = read(client, headers).get_json()["scanId"]
    with app.app_context():
        scan = db.session.get(OcrScan, scan_id)
        scan.confidence = {**scan.confidence, "delivered": 0.5}
        db.session.commit()

    bill = upload_bill(client, headers, delivered="480", ocrScanId=str(scan_id)).get_json()["delivery"]
    assert bill["quantityLowConfidence"] is True

    # Once the office saves a quantity, it has been checked.
    res = client.patch(f"/api/deliveries/{bill['id']}", json={"delivered": 480}, headers=login("accountant"))
    assert res.get_json()["delivery"]["quantityLowConfidence"] is False


def test_a_quantity_the_supervisor_corrected_is_not_flagged(app, client, login, vision_on):
    headers = login("supervisor")
    scan_id = read(client, headers).get_json()["scanId"]
    with app.app_context():
        scan = db.session.get(OcrScan, scan_id)
        scan.confidence = {**scan.confidence, "delivered": 0.5}
        db.session.commit()
    bill = upload_bill(client, headers, delivered="408", ocrScanId=str(scan_id)).get_json()["delivery"]
    assert bill["quantityLowConfidence"] is False


def test_someone_elses_or_a_used_reading_is_not_linked(app, client, login, vision_on):
    scan_id = read(client, login("accountant")).get_json()["scanId"]
    upload_bill(client, login("supervisor"), ocrScanId=str(scan_id))
    with app.app_context():
        assert db.session.get(OcrScan, scan_id).delivery_id is None

    headers = login("supervisor")
    own = read(client, headers).get_json()["scanId"]
    first = upload_bill(client, headers, ocrScanId=str(own)).get_json()["delivery"]
    upload_bill(client, headers, ocrScanId=str(own))
    with app.app_context():
        assert db.session.get(OcrScan, own).delivery_id == first["id"]


def test_a_bill_sent_without_a_reading_still_works(client, login):
    assert upload_bill(client, login("supervisor"), ocrScanId="not-a-number").status_code == 201
