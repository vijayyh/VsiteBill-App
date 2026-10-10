"""A bill's details beyond its photo: its goods (one row each, any number of rows) and what it says
about money. Shared by sending a bill and by the office editing it."""

import json
import math
import re
from datetime import datetime

from .models import DeliveryItem

MAX_ITEMS = 50
ITEM_NUMBERS = ("quantity", "rate", "amount")
ROW_FIELDS = ("description", "quantity", "unit", "rate", "amount")
# Digits with at most one decimal point. Commas and spaces are allowed as grouping ("1,750.94");
# anything else ("1e5", "12abc", "₹10", "-5") is not a number a bill would print.
PLAIN_NUMBER = re.compile(r"^(?:\d+\.?\d*|\.\d+)$")
# API name → column, for the money a bill states (all optional).
AMOUNT_FIELDS = {
    "taxableAmount": "taxable_amount",
    "cgst": "cgst",
    "sgst": "sgst",
    "igst": "igst",
    "totalAmount": "total_amount",
}
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y")


class BillError(ValueError):
    """A value that can't be stored; the message is shown to whoever sent it."""


def number(value, name):
    """A number that isn't negative, or None when left empty."""
    if value is None or value == "":
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise BillError(f"{name} must be a number")
    if isinstance(value, str):
        cleaned = re.sub(r"[,\s]", "", value)
        if cleaned.startswith("-") and PLAIN_NUMBER.match(cleaned[1:]):
            raise BillError(f"{name} can't be negative")
        if not PLAIN_NUMBER.match(cleaned):
            raise BillError(f"{name} must be a number")
        result = float(cleaned)
    else:
        result = float(value)
    if not math.isfinite(result):
        raise BillError(f"{name} must be a number")
    if result < 0:
        raise BillError(f"{name} can't be negative")
    return result


def text(value, name, limit):
    if value is None:
        return None
    if not isinstance(value, str):
        raise BillError(f"{name} must be text")
    return value.strip()[:limit] or None


def bill_date(value):
    if value is None or value == "":
        return None
    if isinstance(value, str):
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
    raise BillError("The bill date must be a date like 2026-08-31")


def items(value):
    """The goods rows: a list (or its JSON text) of {description, quantity, unit, rate, amount}.
    Completely empty rows are dropped."""
    if isinstance(value, str):
        try:
            value = json.loads(value) if value.strip() else []
        except ValueError:
            raise BillError("items must be a list") from None
    if not isinstance(value, list):
        raise BillError("items must be a list")
    if len(value) > MAX_ITEMS:
        raise BillError(f"A bill can have at most {MAX_ITEMS} items")
    rows = []
    for index, raw in enumerate(value, start=1):
        if not isinstance(raw, dict):
            raise BillError(f"Item {index} must be an object")
        row = {
            "description": text(raw.get("description"), f"Item {index} description", 300) or "",
            "unit": text(raw.get("unit"), f"Item {index} unit", 20),
        }
        for key in ITEM_NUMBERS:
            row[key] = number(raw.get(key), f"Item {index} {key}")
        if row["description"] or any(row[key] is not None for key in ITEM_NUMBERS):
            rows.append(row)
    return rows


def apply_items(delivery, rows):
    """Replaces the bill's goods and updates their summary: the item names the lists show, and the
    total quantity the office compares with the PO."""
    delivery.items = [DeliveryItem(position=i, **row) for i, row in enumerate(rows)]
    delivery.item = ", ".join(row["description"] for row in rows if row["description"])[:300]
    quantities = [row["quantity"] for row in rows if row["quantity"] is not None]
    delivery.delivered = round(sum(quantities), 3) if quantities else None


# ── What a save changed ─────────────────────────────────────────────────────────────────────────


def snapshot(delivery):
    """The bill's values as people see them, to compare before and after a save."""
    return {
        "vendor": delivery.vendor or None,
        "invoiceNumber": delivery.invoice_number,
        "billDate": delivery.bill_date.isoformat() if delivery.bill_date else None,
        "poNumber": delivery.po_number or None,
        "items": [{key: getattr(item, key) for key in ROW_FIELDS} for item in delivery.items],
        **{key: getattr(delivery, column) for key, column in AMOUNT_FIELDS.items()},
        "ordered": delivery.ordered,
        "note": delivery.note or None,
        "status": delivery.status,
    }


def reading_values(reading):
    """What a photo reading found, in the shape of a snapshot (only the values it found)."""
    found = {}
    for key, field in (reading or {}).items():
        if not field or key in ("item", "delivered"):
            continue  # those two are the items' summary, compared through the items
        if key == "items":
            found[key] = [{k: row.get(k) for k in ROW_FIELDS} for row in field["value"]]
        else:
            found[key] = field["value"]
    return found


def differences(before, after):
    """Each value that differs, as {"field", "from", "to"}, for the fields both sides have.
    Items are compared row by row ("items.2.quantity"); a row only on one side was added or
    removed ("items.4", with the row as text)."""
    changes = []
    for key, new in after.items():
        if key not in before:
            continue
        old = before[key]
        if key == "items":
            changes += _item_differences(old or [], new or [])
        elif not _same(old, new):
            changes.append({"field": key, "from": old, "to": new})
    return changes


def _item_differences(old_rows, new_rows):
    changes = []
    for index in range(max(len(old_rows), len(new_rows))):
        field = f"items.{index + 1}"
        if index >= len(old_rows):
            changes.append({"field": field, "from": None, "to": _row_text(new_rows[index])})
        elif index >= len(new_rows):
            changes.append({"field": field, "from": _row_text(old_rows[index]), "to": None})
        else:
            for key in ROW_FIELDS:
                old, new = old_rows[index].get(key), new_rows[index].get(key)
                if not _same(old, new):
                    changes.append({"field": f"{field}.{key}", "from": old, "to": new})
    return changes


def _row_text(row):
    """A row in a few words for the history: "M-10 · 36.5 CU.MT"."""
    quantity = row.get("quantity")
    how_much = " ".join(
        part for part in (f"{quantity:g}" if isinstance(quantity, (int, float)) else None, row.get("unit")) if part
    )
    return " · ".join(part for part in (row.get("description"), how_much) if part) or "(empty row)"


def _same(old, new):
    if old in (None, "") and new in (None, ""):
        return True
    if isinstance(old, (int, float)) and isinstance(new, (int, float)) and not isinstance(old, bool):
        return abs(old - new) < 1e-9
    if isinstance(old, str) and isinstance(new, str):
        return old.strip() == new.strip()
    return old == new
