import re

import pytest

from siteverify import drive, payment_sheet
from siteverify.extensions import db
from siteverify.models import GoogleDriveAccount, PaymentApproval, PaymentSheet
from test_deliveries import upload_bill

HEADINGS = [
    "Pay ID", "Date Added", "Site", "Category", "Payee Name", "Bank Details", "Bill Amount", "Amount on hold",
    "Advance", "TDS", "Payable Amount", "PDF Ref", "Status", "View Invoices", "Pay Receipts", "⚠ Duplicate Check",
]
LINK = "https://docs.google.com/spreadsheets/d/1Kxrw73xCv1Y5fSE8TqCH_TESTSHEET01/edit?pli=1&gid=0#gid=0"


class FakeSheet:
    """A payment register laid out like the real one: a title, a colour legend, headings in row 3."""

    def __init__(self, existing=()):
        self.rows = {1: ["PAYMENT REGISTER"], 2: ["Yellow = site/accountant fills"], 3: list(HEADINGS)}
        for row in existing:
            self.rows[max(self.rows) + 1] = row
        self.formulas = {}
        self.fail = False
        self.rules = []  # conditional formatting, in priority order
        self.requests = []

    def metadata(self, spreadsheet_id):
        return {"properties": {"title": "SiteVerify_Demo_Register"}, "sheets": [{"properties": {"sheetId": 0, "title": "Sheet1"}}]}

    def read(self, spreadsheet_id, cell_range):
        if cell_range.endswith("A1:AZ15"):
            return [self.rows.get(n, []) for n in range(1, 16)]
        first = int(re.search(r"A(\d+):A$", cell_range).group(1))
        return [[self.rows[n][0]] if self.rows[n] else [] for n in sorted(self.rows) if n >= first]

    def append(self, spreadsheet_id, cell_range, row):
        if self.fail:
            raise payment_sheet.SheetError("Google Sheets didn't respond properly. Try again in a minute.")
        number = max(self.rows) + 1
        self.rows[number] = row
        return number

    def update(self, spreadsheet_id, cells):
        self.formulas.update(cells)

    def conditional_formats(self, spreadsheet_id, gid):
        return list(self.rules)

    def batch(self, spreadsheet_id, requests):
        for request in requests:
            if "deleteConditionalFormatRule" in request:
                del self.rules[request["deleteConditionalFormatRule"]["index"]]
            elif "addConditionalFormatRule" in request:
                add = request["addConditionalFormatRule"]
                self.rules.insert(add["index"], add["rule"])
            else:
                self.requests.append(request)


@pytest.fixture
def sheet(app, monkeypatch):
    fake = FakeSheet()
    monkeypatch.setattr(payment_sheet, "_metadata", fake.metadata)
    monkeypatch.setattr(payment_sheet, "_read", fake.read)
    monkeypatch.setattr(payment_sheet, "_append", fake.append)
    monkeypatch.setattr(payment_sheet, "_update", fake.update)
    monkeypatch.setattr(payment_sheet, "_conditional_formats", fake.conditional_formats)
    monkeypatch.setattr(payment_sheet, "_batch", fake.batch)

    def fake_upload(project, delivery):
        delivery.drive_file_id = f"file{delivery.id}"
        delivery.drive_web_view_link = f"https://drive.google.com/file/d/file{delivery.id}/view"
        db.session.commit()

    monkeypatch.setattr(drive, "upload_delivery_photo", fake_upload)
    with app.app_context():
        db.session.add(
            GoogleDriveAccount(
                email="accounts@example.com",
                refresh_token="test",
                scopes=f"{payment_sheet.SHEETS_SCOPE} https://www.googleapis.com/auth/drive.file",
                connected_by_id=3,
            )
        )
        db.session.commit()
    return fake


def connect(client, login):
    return client.post("/api/payment-sheet", json={"link": LINK}, headers=login("admin"))


def matched_bill(client, login, **fields):
    bill = upload_bill(client, login("supervisor"), invoiceNumber="MRL/26-27/158", **fields).get_json()["delivery"]
    res = client.patch(
        f"/api/deliveries/{bill['id']}",
        json={"status": "MATCHED", "totalAmount": 711450, "ordered": 480},
        headers=login("accountant"),
    )
    assert res.status_code == 200
    return res.get_json()["delivery"]


APPROVAL = {"category": "Material", "bankDetails": "HDFC 50200012345678, IFSC HDFC0001234", "amountOnHold": "1,000", "tds": "7114.50"}


def approve(client, login, bill, body=APPROVAL, role="accountant"):
    return client.post(f"/api/deliveries/{bill['id']}/payment", json=body, headers=login(role))


# ── Connecting the sheet ────────────────────────────────────────────────────────────────────────


def test_the_admin_connects_the_sheet_by_its_link(client, login, sheet):
    res = connect(client, login)
    assert res.status_code == 200
    assert res.get_json()["sheet"]["title"] == "SiteVerify_Demo_Register"
    assert res.get_json()["sheet"]["tabTitle"] == "Sheet1"
    status = client.get("/api/payment-sheet", headers=login("accountant")).get_json()
    assert status["sheetsAllowed"] is True
    assert status["sheet"]["url"].startswith("https://docs.google.com/spreadsheets/d/1Kxrw73xCv1Y5fSE8TqCH_TESTSHEET01")
    assert "Material" in status["categories"]


def test_pay_ids_carry_on_from_the_sheet(app, client, login, sheet):
    sheet.rows[4] = ["PAY-0004", "2026-10-01"]
    sheet.rows[5] = ["PAY-0007"]
    connect(client, login)
    with app.app_context():
        assert PaymentSheet.query.one().next_pay_number == 8


def test_a_sheet_without_the_registers_headings_is_refused(client, login, sheet):
    sheet.rows[3] = ["Name", "Amount"]
    res = connect(client, login)
    assert res.status_code == 400
    assert "headings" in res.get_json()["error"]


def test_a_link_that_isnt_a_sheet_is_refused(client, login, sheet):
    res = client.post("/api/payment-sheet", json={"link": "https://example.com/x"}, headers=login("admin"))
    assert res.status_code == 400


def test_only_an_admin_connects_or_disconnects_the_sheet(client, login, sheet):
    assert client.post("/api/payment-sheet", json={"link": LINK}, headers=login("accountant")).status_code == 403
    assert client.delete("/api/payment-sheet", headers=login("accountant")).status_code == 403
    assert client.get("/api/payment-sheet", headers=login("supervisor")).status_code == 403


def test_google_connected_before_sheets_needs_connecting_again(app, client, login, sheet):
    with app.app_context():
        GoogleDriveAccount.query.one().scopes = None
        db.session.commit()
    assert client.get("/api/payment-sheet", headers=login("admin")).get_json()["sheetsAllowed"] is False


# ── Approving a bill for payment ────────────────────────────────────────────────────────────────


def test_approving_a_matched_bill_adds_its_row(app, client, login, sheet):
    connect(client, login)
    bill = matched_bill(client, login)
    res = approve(client, login, bill)
    assert res.status_code == 200
    payment = res.get_json()["delivery"]["payment"]
    assert payment["payId"] == "PAY-0001"
    assert payment["payable"] == 711450 - 1000 - 7114.5
    assert payment["sheetRow"] == 4
    assert payment["approvedBy"] == "Priya Deshmukh"

    row = sheet.rows[4]
    cell = dict(zip(HEADINGS, row))
    assert cell["Pay ID"] == "PAY-0001"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", cell["Date Added"])
    assert cell["Site"] == "'KH-PRJ-014 · Andheri Metro Depot, Phase 2"
    assert cell["Category"] == "'Material"
    assert cell["Payee Name"] == "'UltraTech Cement"
    assert cell["Bank Details"] == "'HDFC 50200012345678, IFSC HDFC0001234"
    assert (cell["Bill Amount"], cell["Amount on hold"], cell["Advance"], cell["TDS"]) == (711450, 1000, 0, 7114.5)
    assert cell["PDF Ref"] == "'MRL/26-27/158"
    assert cell["View Invoices"] == f'=HYPERLINK("https://drive.google.com/file/d/file{bill["id"]}/view","View bill")'
    # The payment manager's columns are left alone.
    assert cell["Status"] is None and cell["Pay Receipts"] is None
    assert sheet.formulas["'Sheet1'!K4"] == "=G4-H4-I4-J4"
    assert sheet.formulas["'Sheet1'!P4"].startswith('=IF(AND(L4<>"",COUNTIF(L$4:L,L4)>1),"⚠ Same bill no."')

    history = client.get(f"/api/deliveries/{bill['id']}/changes", headers=login("admin")).get_json()["changes"]
    assert history[0]["action"] == "payment"
    assert history[0]["changes"] == [{"field": "payment", "from": None, "to": "PAY-0001"}]


def test_the_vendors_bank_details_are_remembered(client, login, sheet):
    connect(client, login)
    approve(client, login, matched_bill(client, login))
    second = matched_bill(client, login, vendor="  ultratech   CEMENT ")
    defaults = client.get(f"/api/deliveries/{second['id']}/payment", headers=login("accountant")).get_json()
    assert defaults["bankDetails"] == APPROVAL["bankDetails"]
    assert approve(client, login, second).get_json()["delivery"]["payment"]["payId"] == "PAY-0002"


def test_a_bill_is_approved_only_once(client, login, sheet):
    connect(client, login)
    bill = matched_bill(client, login)
    approve(client, login, bill)
    res = approve(client, login, bill)
    assert res.status_code == 409
    assert "PAY-0001" in res.get_json()["error"]
    assert len([n for n in sheet.rows if n > 3]) == 1


def test_only_matched_bills_with_a_total_can_be_approved(client, login, sheet):
    connect(client, login)
    pending = upload_bill(client, login("supervisor")).get_json()["delivery"]
    assert approve(client, login, pending).status_code == 409
    no_total = upload_bill(client, login("supervisor")).get_json()["delivery"]
    client.patch(f"/api/deliveries/{no_total['id']}", json={"status": "MATCHED"}, headers=login("accountant"))
    res = approve(client, login, no_total)
    assert res.status_code == 409
    assert "total amount" in res.get_json()["error"]


@pytest.mark.parametrize(
    "body",
    [
        {"category": "Snacks"},
        {"category": "Material", "tds": "12abc"},
        {"category": "Material", "advance": "-5"},
        {"category": "Material", "amountOnHold": "800000"},  # more than the bill
    ],
)
def test_bad_approvals_are_refused_and_add_nothing(app, client, login, sheet, body):
    connect(client, login)
    bill = matched_bill(client, login)
    assert approve(client, login, bill, body).status_code == 400
    assert len(sheet.rows) == 3
    with app.app_context():
        assert PaymentApproval.query.count() == 0


def test_approving_needs_the_sheet_connected(client, login, sheet):
    res = approve(client, login, matched_bill(client, login))
    assert res.status_code == 409
    assert "isn't connected" in res.get_json()["error"]


def test_if_the_sheet_fails_nothing_is_recorded(app, client, login, sheet):
    connect(client, login)
    bill = matched_bill(client, login)
    sheet.fail = True
    res = approve(client, login, bill)
    assert res.status_code == 502
    with app.app_context():
        assert PaymentApproval.query.count() == 0
        assert PaymentSheet.query.one().next_pay_number == 1  # the Pay ID isn't used up
    sheet.fail = False
    assert approve(client, login, bill).get_json()["delivery"]["payment"]["payId"] == "PAY-0001"


def test_supervisors_cant_approve_payments(client, login, sheet):
    connect(client, login)
    bill = matched_bill(client, login)
    assert approve(client, login, bill, role="supervisor").status_code == 403
    assert client.get(f"/api/deliveries/{bill['id']}/payment", headers=login("supervisor")).status_code == 403


def test_admins_can_approve_too(client, login, sheet):
    connect(client, login)
    assert approve(client, login, matched_bill(client, login), role="admin").status_code == 200


def test_a_google_sign_in_that_stopped_working_says_so(app, sheet):
    from google.auth.exceptions import RefreshError

    class Request:
        def execute(self):
            raise RefreshError("invalid_grant")

    with app.app_context(), pytest.raises(payment_sheet.SheetError, match="no longer works"):
        payment_sheet._call(Request())


def test_connecting_google_records_the_permissions_and_allows_a_slow_clock(app, monkeypatch):
    # The real flow: Google's token comes back with the granted permissions; its "issued at" time
    # can be a few seconds ahead of the server's clock.
    from types import SimpleNamespace

    from siteverify.models import DriveOAuthState

    checked = {}

    class Flow:
        code_verifier = None
        credentials = SimpleNamespace(id_token="id-token", refresh_token="refresh", scopes=None)

        def fetch_token(self, code):
            return {"scope": ["openid", payment_sheet.SHEETS_SCOPE, "https://www.googleapis.com/auth/drive.file"]}

    def verify(token, request, audience, clock_skew_in_seconds=0):
        checked["skew"] = clock_skew_in_seconds
        return {"email": "accounts@example.com"}

    monkeypatch.setattr(drive, "_flow", lambda: Flow())
    monkeypatch.setattr(drive.google_id_token, "verify_oauth2_token", verify)
    monkeypatch.setattr(drive, "build", lambda *a, **k: None)
    monkeypatch.setattr(drive, "_ensure_root_folder", lambda service, account: "root")
    monkeypatch.setattr(drive, "_ensure_project_folder", lambda service, account, project: "folder")
    with app.app_context():
        db.session.add(DriveOAuthState(state="s1", code_verifier="v", admin_id=3))
        db.session.commit()
        account = drive.exchange_code("code", "s1")
        assert checked["skew"] >= 10
        assert account.email == "accounts@example.com"
        assert account.has_scope(payment_sheet.SHEETS_SCOPE)


# ── How the sheet looks ─────────────────────────────────────────────────────────────────────────


def formulas(sheet):
    return [rule["booleanRule"]["condition"]["values"][0]["userEnteredValue"] for rule in sheet.rules]


def test_connecting_colours_the_rows_by_status(client, login, sheet):
    connect(client, login)
    assert formulas(sheet) == [
        '=AND($A4<>"",LOWER(TRIM($M4))="paid",$O4="")',  # Paid without a receipt: the receipt cell turns red
        '=AND($A4<>"",LEFT($P4,1)="⚠")',  # a duplicate warning
        '=AND($A4<>"",LOWER(TRIM($M4))="paid",$O4<>"")',  # paid with the receipt: green row
        '=AND($A4<>"",LOWER(TRIM($M4))="rejected")',
        '=AND($A4<>"",LOWER(TRIM($M4))="on hold")',
        '=AND($A4<>"",LOWER(TRIM($M4))="pending")',  # brown row
        '=$A4<>""',  # any other bill: yellow until it's paid with a receipt
    ]
    receipt_rule, row_rule = sheet.rules[0], sheet.rules[-1]
    assert receipt_rule["ranges"][0]["startColumnIndex"] == 14  # just the Pay Receipts cell
    assert (row_rule["ranges"][0]["startRowIndex"], row_rule["ranges"][0]["startColumnIndex"]) == (3, 0)  # rows from 4, from A
    assert row_rule["booleanRule"]["format"]["backgroundColor"] == payment_sheet.YELLOW
    assert sheet.rules[5]["booleanRule"]["format"]["backgroundColor"] == payment_sheet.BROWN

    kinds = {next(iter(r)): r for r in sheet.requests}
    assert kinds["updateSheetProperties"]["updateSheetProperties"]["properties"]["gridProperties"]["frozenRowCount"] == 3
    dropdown = kinds["setDataValidation"]["setDataValidation"]
    assert dropdown["range"]["startColumnIndex"] == 12  # Status
    assert [v["userEnteredValue"] for v in dropdown["rule"]["condition"]["values"]] == ["Pending", "On hold", "Paid", "Rejected"]
    assert "Brown: Pending" in kinds["updateCells"]["updateCells"]["rows"][0]["values"][0]["note"]


def test_connecting_again_doesnt_pile_up_rules_or_touch_anyone_elses(client, login, sheet):
    theirs = {"ranges": [], "booleanRule": {"condition": {"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": "=$G4>100000"}]}}}
    sheet.rules.append(theirs)
    connect(client, login)
    connect(client, login)
    assert len(sheet.rules) == 8
    assert sheet.rules[-1] is theirs


def test_the_app_still_never_writes_the_payment_managers_columns(client, login, sheet):
    connect(client, login)
    approve(client, login, matched_bill(client, login))
    cell = dict(zip(HEADINGS, sheet.rows[4]))
    assert cell["Status"] is None and cell["Pay Receipts"] is None
