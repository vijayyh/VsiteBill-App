"""The payment register: a Google Sheet the payment manager pays from.

The office approves a matched bill for payment and it becomes one row there: Pay ID, date,
site, category, payee, bank details, the bill amount and what's held back, with the payable
amount and a duplicate warning as sheet formulas. The payment manager's columns (Status, Pay
Receipts) are never written: they set PAID, paste the UTR and attach the slip themselves.

Writes go through the Google account connected for Drive (drive.py), which needs the
spreadsheets permission. The sheet is found by its column headings, so it can be laid out with
title rows above the table and the columns in any order.
"""

import re
from datetime import datetime, timedelta, timezone

from flask import current_app
from google.auth.exceptions import RefreshError
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from . import drive
from .extensions import db
from .models import Delivery, PaymentSheet

SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"

# The headings the app reads or writes (matched case-insensitively, ignoring symbols like "⚠").
PAY_ID = "pay id"
DATE_ADDED = "date added"
SITE = "site"
CATEGORY = "category"
PAYEE = "payee name"
BANK = "bank details"
BILL_AMOUNT = "bill amount"
HOLD = "amount on hold"
ADVANCE = "advance"
TDS = "tds"
PAYABLE = "payable amount"
PDF_REF = "pdf ref"
VIEW_INVOICES = "view invoices"
DUPLICATE = "duplicate check"
# The payment manager's columns: never written, only used to colour the rows.
STATUS = "status"
RECEIPTS = "pay receipts"
REQUIRED = (PAY_ID, DATE_ADDED, SITE, CATEGORY, PAYEE, BANK, BILL_AMOUNT, HOLD, ADVANCE, TDS, PAYABLE)
OPTIONAL = (PDF_REF, VIEW_INVOICES, DUPLICATE, STATUS, RECEIPTS)

# The Status dropdown, and what the row colours mean (shown as a note on the Status heading).
STATUSES = ("Pending", "On hold", "Paid", "Rejected")
COLOUR_KEY = (
    "Row colours\n"
    "Yellow: new bill, awaiting payment\n"
    "Brown: Pending\n"
    "Orange: On hold\n"
    "Green: Paid, with the receipt attached\n"
    "Grey: Rejected\n"
    "A red Pay Receipts cell: marked Paid but no receipt attached yet."
)

CATEGORIES = ("Material", "Labour", "Transport", "Equipment hire", "Services", "Other")
IST = timezone(timedelta(hours=5, minutes=30))
LINK = re.compile(r"/spreadsheets/d/([A-Za-z0-9_-]{20,})(?:.*?[#&?]gid=(\d+))?")


class SheetError(Exception):
    """A problem with the sheet or the connection; the message is shown to whoever acted."""


def get_sheet() -> PaymentSheet | None:
    return PaymentSheet.query.first()


def _heading(text):
    return re.sub(r"[^a-z0-9 ]", "", str(text).lower()).strip()


def _letter(index):
    letters = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


# ── Google calls (small, so tests can replace them) ─────────────────────────────────────────────


def _service():
    account = drive.get_account()
    if account is None:
        raise SheetError("Connect a Google account first (Admin → Google Drive)")
    if not account.has_scope(SHEETS_SCOPE):
        raise SheetError("Connect Google again to allow the payment sheet (Admin → Google Drive → Reconnect)")
    return build("sheets", "v4", credentials=drive.credentials(account), cache_discovery=False)


def _call(request):
    account = drive.get_account()
    who = account.email if account else "the connected Google account"
    try:
        return request.execute()
    except HttpError as e:
        status = getattr(e.resp, "status", 0)
        if status == 403:
            raise SheetError(f"{who} can't edit this sheet. Share it with that account as an editor.") from None
        if status == 404:
            raise SheetError("That sheet wasn't found. Check the link.") from None
        current_app.logger.exception("Google Sheets request failed")
        raise SheetError("Google Sheets didn't respond properly. Try again in a minute.") from None
    except RefreshError:
        # The connection was revoked, expired, or the server's Google keys changed.
        current_app.logger.exception("Google sign-in for the payment sheet failed")
        raise SheetError(f"Google sign-in for {who} no longer works. Connect Google again (Admin → Google Drive).") from None
    except Exception:
        current_app.logger.exception("Google Sheets request failed")
        raise SheetError("Couldn't reach Google Sheets. Try again in a minute.") from None


def _conditional_formats(spreadsheet_id, gid):
    """The colour rules already on the tab."""
    meta = _call(
        _service().spreadsheets().get(spreadsheetId=spreadsheet_id, fields="sheets(properties.sheetId,conditionalFormats)")
    )
    for tab in meta.get("sheets", []):
        if tab.get("properties", {}).get("sheetId") == gid:
            return tab.get("conditionalFormats", [])
    return []


def _batch(spreadsheet_id, requests):
    _call(_service().spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}))


def _metadata(spreadsheet_id):
    return _call(_service().spreadsheets().get(spreadsheetId=spreadsheet_id, fields="properties.title,sheets.properties"))


def _read(spreadsheet_id, cell_range):
    return _call(_service().spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=cell_range)).get("values", [])


def _append(spreadsheet_id, cell_range, row):
    """Writes the row into the first empty row under the table; returns the row number used."""
    result = _call(
        _service()
        .spreadsheets()
        .values()
        .append(
            spreadsheetId=spreadsheet_id,
            range=cell_range,
            valueInputOption="USER_ENTERED",
            insertDataOption="OVERWRITE",
            body={"values": [row]},
        )
    )
    updated = result.get("updates", {}).get("updatedRange", "")
    match = re.search(r"![A-Z]+(\d+)", updated)
    return int(match.group(1)) if match else None


def _update(spreadsheet_id, cells):
    """Sets formulas: {"K7": "=G7-H7", …}."""
    data = [{"range": cell, "values": [[value]]} for cell, value in cells.items()]
    _call(
        _service()
        .spreadsheets()
        .values()
        .batchUpdate(spreadsheetId=spreadsheet_id, body={"valueInputOption": "USER_ENTERED", "data": data})
    )


# ── Connecting the sheet ────────────────────────────────────────────────────────────────────────


def connect(link, admin):
    """Remembers the sheet at `link` after checking it has the payment register's columns."""
    match = LINK.search(link or "")
    if not match:
        raise SheetError("Paste the sheet's link (it starts with https://docs.google.com/spreadsheets/d/…)")
    spreadsheet_id, gid = match.group(1), int(match.group(2) or 0)

    meta = _metadata(spreadsheet_id)
    tabs = [s["properties"] for s in meta.get("sheets", [])]
    tab = next((t for t in tabs if t.get("sheetId") == gid), tabs[0] if tabs else None)
    if tab is None:
        raise SheetError("That sheet has no tabs.")
    quoted = "'" + tab["title"].replace("'", "''") + "'"

    rows = _read(spreadsheet_id, f"{quoted}!A1:AZ15")
    header_row, columns = None, {}
    for number, row in enumerate(rows, start=1):
        found = {_heading(cell): i for i, cell in enumerate(row) if _heading(cell)}
        if all(name in found for name in REQUIRED):
            header_row = number
            columns = {name: found[name] for name in REQUIRED + OPTIONAL if name in found}
            break
    if header_row is None:
        raise SheetError(
            "Couldn't find the payment register's headings (Pay ID, Date Added, Site, Category, Payee Name, "
            "Bank Details, Bill Amount, Amount on hold, Advance, TDS, Payable Amount) in the first 15 rows."
        )

    # Carry on the Pay ID numbering from what the sheet already holds.
    pay_ids = _read(spreadsheet_id, f"{quoted}!{_letter(columns[PAY_ID])}{header_row + 1}:{_letter(columns[PAY_ID])}")
    numbers = [int(m.group(1)) for row in pay_ids if row for m in [re.match(r"PAY-(\d+)$", str(row[0]))] if m]

    sheet = get_sheet() or PaymentSheet(connected_by_id=admin.id)
    sheet.spreadsheet_id = spreadsheet_id
    sheet.gid = tab.get("sheetId", 0)
    sheet.tab_title = tab["title"]
    sheet.title = meta.get("properties", {}).get("title", "Payment sheet")
    sheet.header_row = header_row
    sheet.columns = columns
    sheet.next_pay_number = max(numbers, default=0) + 1
    sheet.connected_by_id = admin.id
    sheet.connected_at = datetime.now(timezone.utc)

    row_count = tab.get("gridProperties", {}).get("rowCount", 1000)
    _batch(spreadsheet_id, format_requests(sheet, row_count, _conditional_formats(spreadsheet_id, sheet.gid)))

    if sheet.id is None:
        db.session.add(sheet)
    db.session.commit()
    return sheet


# ── How the sheet looks ─────────────────────────────────────────────────────────────────────────


def _colour(hex_code):
    return {"red": int(hex_code[0:2], 16) / 255, "green": int(hex_code[2:4], 16) / 255, "blue": int(hex_code[4:6], 16) / 255}


YELLOW, BROWN, ORANGE, GREEN, GREY, RED = (
    _colour(c) for c in ("FFF4C2", "EBD9C6", "FDE2C8", "D7EED8", "ECECEC", "F8D2D2")
)
GREY_TEXT, RED_TEXT = _colour("8A8A8A"), _colour("9B1C1C")


def colour_rules(sheet):
    """The colour rules, most specific first (in Google Sheets the first rule that matches a cell
    wins): (column name or None for the whole row, formula, format)."""
    col = {name: _letter(index) for name, index in sheet.columns.items()}
    first = sheet.header_row + 1
    has_bill = f'${col[PAY_ID]}{first}<>""'
    rules = []
    if STATUS in col:
        status = f"LOWER(TRIM(${col[STATUS]}{first}))"
        if RECEIPTS in col:
            receipt = f'${col[RECEIPTS]}{first}<>""'
            rules.append((RECEIPTS, f'=AND({has_bill},{status}="paid",${col[RECEIPTS]}{first}="")', {"backgroundColor": RED}))
            done = f'=AND({has_bill},{status}="paid",{receipt})'
        else:
            done = f'=AND({has_bill},{status}="paid")'
    if DUPLICATE in col:
        rules.append(
            (
                DUPLICATE,
                f'=AND({has_bill},LEFT(${col[DUPLICATE]}{first},1)="⚠")',
                {"backgroundColor": RED, "textFormat": {"bold": True, "foregroundColor": RED_TEXT}},
            )
        )
    if STATUS in col:
        rules += [
            (None, done, {"backgroundColor": GREEN}),
            (None, f'=AND({has_bill},{status}="rejected")', {"backgroundColor": GREY, "textFormat": {"foregroundColor": GREY_TEXT}}),
            (None, f'=AND({has_bill},{status}="on hold")', {"backgroundColor": ORANGE}),
            (None, f'=AND({has_bill},{status}="pending")', {"backgroundColor": BROWN}),
        ]
    rules.append((None, f"={has_bill}", {"backgroundColor": YELLOW}))
    return rules


def format_requests(sheet, row_count, existing):
    """Colours rows by their status, gives Status a dropdown, freezes the headings and adds the
    colour key. Running it again replaces the app's own colour rules and leaves anyone else's."""
    gid, width = sheet.gid, max(sheet.columns.values()) + 1
    data = {"sheetId": gid, "startRowIndex": sheet.header_row, "endRowIndex": max(row_count, sheet.header_row + 1)}

    def cells(name=None):
        if name is None:
            return {**data, "startColumnIndex": 0, "endColumnIndex": width}
        return {**data, "startColumnIndex": sheet.columns[name], "endColumnIndex": sheet.columns[name] + 1}

    rules = colour_rules(sheet)
    ours = {formula for _, formula, _ in rules}

    def formula_of(rule):
        values = rule.get("booleanRule", {}).get("condition", {}).get("values", [])
        return values[0].get("userEnteredValue") if values else None

    requests = [
        {"deleteConditionalFormatRule": {"sheetId": gid, "index": index}}
        for index in sorted((i for i, rule in enumerate(existing) if formula_of(rule) in ours), reverse=True)
    ]
    requests += [
        {
            "addConditionalFormatRule": {
                "index": index,
                "rule": {
                    "ranges": [cells(name)],
                    "booleanRule": {"condition": {"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": formula}]}, "format": fmt},
                },
            }
        }
        for index, (name, formula, fmt) in enumerate(rules)
    ]
    requests.append(
        {
            "updateSheetProperties": {
                "properties": {"sheetId": gid, "gridProperties": {"frozenRowCount": sheet.header_row}},
                "fields": "gridProperties.frozenRowCount",
            }
        }
    )
    if STATUS in sheet.columns:
        requests.append(
            {
                "setDataValidation": {
                    "range": cells(STATUS),
                    "rule": {
                        "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": s} for s in STATUSES]},
                        "showCustomUi": True,
                        "strict": False,
                        "inputMessage": "Pick the payment status. Paid turns the row green once the receipt is attached.",
                    },
                }
            }
        )
        column = sheet.columns[STATUS]
        requests.append(
            {
                "updateCells": {
                    "range": {
                        "sheetId": gid,
                        "startRowIndex": sheet.header_row - 1,
                        "endRowIndex": sheet.header_row,
                        "startColumnIndex": column,
                        "endColumnIndex": column + 1,
                    },
                    "rows": [{"values": [{"note": COLOUR_KEY}]}],
                    "fields": "note",
                }
            }
        )
    return requests


def disconnect():
    sheet = get_sheet()
    if sheet:
        db.session.delete(sheet)
        db.session.commit()


# ── A bill's row ────────────────────────────────────────────────────────────────────────────────


def _text(value):
    # A leading apostrophe keeps text as text ("2025/1" would otherwise become a date).
    return "'" + value if value else ""


def add_bill(delivery: Delivery, approval):
    """Writes the bill's row; returns its row number (None if Google didn't say)."""
    sheet = get_sheet()
    if sheet is None:
        raise SheetError("The payment sheet isn't connected yet. Ask an admin to connect it.")
    columns = sheet.columns
    width = max(columns.values()) + 1
    row = [None] * width  # None leaves a cell as it is (the payment manager's columns stay theirs)

    def put(name, value):
        if name in columns:
            row[columns[name]] = value

    project = delivery.project
    put(PAY_ID, approval.pay_id)
    put(DATE_ADDED, datetime.now(IST).date().isoformat())
    put(SITE, _text(f"{project.code} · {project.name}"))
    put(CATEGORY, _text(approval.category))
    put(PAYEE, _text(delivery.vendor))
    put(BANK, _text(approval.bank_details or ""))
    put(BILL_AMOUNT, approval.bill_amount)
    put(HOLD, approval.amount_on_hold)
    put(ADVANCE, approval.advance)
    put(TDS, approval.tds)
    put(PAYABLE, round(approval.bill_amount - approval.amount_on_hold - approval.advance - approval.tds, 2))
    put(PDF_REF, _text(delivery.invoice_number or ""))
    if delivery.drive_web_view_link:
        put(VIEW_INVOICES, f'=HYPERLINK("{delivery.drive_web_view_link}","View bill")')

    quoted = "'" + sheet.tab_title.replace("'", "''") + "'"
    first, last = _letter(0), _letter(width - 1)
    number = _append(sheet.spreadsheet_id, f"{quoted}!{first}{sheet.header_row}:{last}", row)
    if number:
        try:
            _update(sheet.spreadsheet_id, _formulas(sheet, quoted, number))
        except SheetError:
            # The row is in with the payable amount as a number; only the live formulas are missing.
            current_app.logger.exception("Couldn't add the payment sheet formulas to row %s", number)
    return number


def _formulas(sheet, quoted, number):
    """The payable amount and the duplicate warning as formulas, so the sheet keeps them right
    when someone changes the hold, advance or TDS there."""
    col = {name: _letter(index) for name, index in sheet.columns.items()}
    first = sheet.header_row + 1
    cells = {}
    if PAYABLE in col:
        cells[f"{quoted}!{col[PAYABLE]}{number}"] = (
            f"={col[BILL_AMOUNT]}{number}-{col[HOLD]}{number}-{col[ADVANCE]}{number}-{col[TDS]}{number}"
        )
    if DUPLICATE in col:
        payee, amount = col[PAYEE], col[BILL_AMOUNT]
        same_payee_amount = f"COUNTIFS({payee}${first}:{payee},{payee}{number},{amount}${first}:{amount},{amount}{number})>1"
        if PDF_REF in col:
            ref = col[PDF_REF]
            same_ref = f'AND({ref}{number}<>"",COUNTIF({ref}${first}:{ref},{ref}{number})>1)'
            cells[f"{quoted}!{col[DUPLICATE]}{number}"] = (
                f'=IF({same_ref},"⚠ Same bill no.",IF({same_payee_amount},"⚠ Same payee and amount",""))'
            )
        else:
            cells[f"{quoted}!{col[DUPLICATE]}{number}"] = f'=IF({same_payee_amount},"⚠ Same payee and amount","")'
    return cells
