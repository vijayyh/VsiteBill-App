"""A bill's details beyond its photo: its goods (one row each, any number of rows) and what it says
about money. Shared by sending a bill and by the office editing it."""

import json
import math
from datetime import datetime

from .models import DeliveryItem

MAX_ITEMS = 50
ITEM_NUMBERS = ("quantity", "rate", "amount")
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
    try:
        result = float(value.replace(",", "")) if isinstance(value, str) else float(value)
    except ValueError:
        raise BillError(f"{name} must be a number") from None
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
