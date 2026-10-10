"""Reading a bill photo (OCR): vendor, item, quantity delivered and PO number.

Two layers, so the reading service can be swapped without touching anything else:

- A *provider* turns a photo into words with their positions. Today that's Google Cloud Vision
  (OCR_PROVIDER=google); a home-grown model can be added later as another provider.
- The *parser* (`parse_page`) turns those words into the four bill fields, each with a confidence
  between 0 and 1. It only sees words and boxes, so it works the same whichever provider read them.

The bill form calls this through POST /api/ocr/bill and fills in the fields the supervisor hasn't
typed yet; the supervisor always checks them before sending.
"""

import base64
import datetime
import json
import math
import re
import statistics
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from flask import current_app

# Below this, a field the bill form fills in is marked "check this", and a quantity kept as read
# shows the office the DOUBLE-CHECK badge.
LOW_CONFIDENCE = 0.85

VISION_URL = "https://vision.googleapis.com/v1/images:annotate"
# Vision accepts up to 10 MB of JSON per request; base64 makes the photo a third bigger.
MAX_PHOTO_BYTES = 7 * 1024 * 1024


class OcrError(Exception):
    """The reading service failed (network, quota, bad key, unreadable image)."""


@dataclass
class Word:
    text: str
    confidence: float
    x0: float
    y0: float
    x1: float
    y1: float
    # Whether the reader saw a space after this word ("KH/PO/4471" comes back as five words).
    space_after: bool = True

    @property
    def cx(self):
        return (self.x0 + self.x1) / 2

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2

    @property
    def h(self):
        return max(1.0, self.y1 - self.y0)


@dataclass
class Line:
    """A line of text as the reader grouped it (in reading order, so a table row's cells may be
    separate lines)."""

    words: list[Word]

    @property
    def text(self):
        return _join(self.words)

    @property
    def y0(self):
        return min(w.y0 for w in self.words)

    @property
    def y1(self):
        return max(w.y1 for w in self.words)

    @property
    def x0(self):
        return min(w.x0 for w in self.words)

    @property
    def x1(self):
        return max(w.x1 for w in self.words)

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2

    @property
    def height(self):
        return statistics.median(w.h for w in self.words)

    @property
    def confidence(self):
        return _mean_confidence(self.words)


@dataclass
class Page:
    lines: list[Line] = field(default_factory=list)
    text: str = ""

    @property
    def words(self):
        return [w for line in self.lines for w in line.words]


@dataclass
class Reading:
    """What was read off one photo. Each field is {"value": …, "confidence": 0–1} or None."""

    provider: str
    text: str
    fields: dict


# ── Provider ────────────────────────────────────────────────────────────────────────────────────


def configured() -> bool:
    c = current_app.config
    return c["OCR_PROVIDER"] == "google" and bool(c["GOOGLE_VISION_API_KEY"])


def read_bill(photo: bytes) -> Reading:
    """Reads a bill photo with the configured provider. Raises OcrError if the reading fails."""
    if len(photo) > MAX_PHOTO_BYTES:
        raise OcrError("Photo too large to read")
    page = _google_vision(photo)
    return Reading(provider="google", text=page.text, fields=parse_page(page))


def _google_vision(photo: bytes) -> Page:
    body = {
        "requests": [
            {
                "image": {"content": base64.b64encode(photo).decode("ascii")},
                # Document mode reads dense printed text (bills) better than plain TEXT_DETECTION.
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
            }
        ]
    }
    request = urllib.request.Request(
        VISION_URL,
        data=json.dumps(body).encode(),
        # The key goes in a header, not the URL, so it never shows up in request logs.
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": current_app.config["GOOGLE_VISION_API_KEY"]},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=current_app.config["OCR_TIMEOUT_SECONDS"]) as res:
            data = json.load(res)
    except urllib.error.HTTPError as e:
        try:
            message = json.load(e).get("error", {}).get("message", "")
        except ValueError:
            message = ""
        raise OcrError(f"Vision API returned {e.code}: {message}") from e
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise OcrError(f"Vision API request failed: {e}") from e

    response = (data.get("responses") or [{}])[0]
    if "error" in response:
        raise OcrError(f"Vision API error: {response['error'].get('message', '')}")
    return page_from_vision(response.get("fullTextAnnotation") or {})


def page_from_vision(annotation: dict) -> Page:
    """Turns Vision's fullTextAnnotation into lines of positioned words, straightened so text runs
    left to right on a level page even if the photo was taken sideways or a little crooked."""
    lines = []
    for page in (annotation.get("pages") or [])[:1]:
        for block in page.get("blocks", []):
            for paragraph in block.get("paragraphs", []):
                current = []
                for word in paragraph.get("words", []):
                    symbols = word.get("symbols", [])
                    text = "".join(s.get("text", "") for s in symbols)
                    vertices = [(v.get("x", 0), v.get("y", 0)) for v in word.get("boundingBox", {}).get("vertices", [])]
                    if not text or len(vertices) != 4:
                        continue
                    ends = symbols[-1].get("property", {}).get("detectedBreak", {}).get("type") if symbols else None
                    current.append((text, word.get("confidence", 1.0), vertices, ends is not None and ends != "HYPHEN"))
                    if ends in ("LINE_BREAK", "EOL_SURE_SPACE"):
                        lines.append(current)
                        current = []
                if current:
                    lines.append(current)

    # Vision lists each word's corners starting at the top-left *of the text*, so the first edge
    # gives the direction the text runs. Rotating everything by the median of those angles turns a
    # sideways or tilted photo upright.
    angles = [math.atan2(v[1][1] - v[0][1], v[1][0] - v[0][0]) for line in lines for _, _, v, _ in line]
    angle = statistics.median(angles) if angles else 0.0
    cos, sin = math.cos(-angle), math.sin(-angle)

    def upright(vertices):
        xs = [x * cos - y * sin for x, y in vertices]
        ys = [x * sin + y * cos for x, y in vertices]
        return min(xs), min(ys), max(xs), max(ys)

    page = Page(
        lines=[Line([Word(text, conf, *upright(v), spaced) for text, conf, v, spaced in line]) for line in lines],
        text=annotation.get("text", ""),
    )
    return page


# ── Parser ──────────────────────────────────────────────────────────────────────────────────────

NUMBER = re.compile(r"^\d{1,3}(?:,\d{2,3})+(?:\.\d+)?$|^\d+(?:\.\d+)?$")
UNITS = (
    r"BAGS?|NOS?\.?|NUMBERS?|MT|M\.T\.?|TONS?|TONNES?|KGS?|KG\.|CUM|CU\.?\s?M|M3|CFT|BRASS|LTRS?|"
    r"LITRES?|LITERS?|PCS|PIECES|SQ\.?\s?FT|SQFT|SQM|RMT|MTRS?|METERS?|METRES?|BUNDLES?|BOXES|BOX|"
    r"TRUCKS?|LOADS?|TRIPS?|BUCKETS?|DRUMS?|ROLLS?|SETS?|PAIRS?|UNITS?"
)
QTY_WITH_UNIT = re.compile(rf"(?<![\w.])(\d{{1,3}}(?:,\d{{2,3}})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*({UNITS})(?![A-Z])", re.I)
QTY_LABEL = re.compile(r"\b(?:QTY|QUANTITY|QNTY)\b\.?\s*(?:\([^)]*\))?\s*[:\-=]?\s*(\d[\d,]*(?:\.\d+)?)", re.I)
ITEM_LABEL = re.compile(
    r"\b(?:MATERIAL|ITEM|DESCRIPTION|PARTICULARS|GOODS)(?:\s+(?:NAME|DESCRIPTION|DETAILS))?\s*[:\-]\s*(.{3,})", re.I
)
PO_STRONG = re.compile(
    r"(?:(?<![A-Z])P\s?\.?\s?O(?![A-Z])\.?|PURCHASE\s+ORDER)(?!\s*\.?\s*(?:DATE|DT)\b)"
    r"\s*(?:NO|NUMBER|NUM|REF|#)?\.?\s*[:#\-–]?",
    re.I,
)
# "Order No." is often the seller's own order number, so it only counts when no PO label is printed.
PO_WEAK = re.compile(r"\bORDER\s*(?:NO|NUMBER|#)\.?\s*[:#\-–]?", re.I)
INVOICE_LABELS = [
    re.compile(p, re.I)
    for p in (
        r"\b(?:TAX\s+)?INVOICE\s*(?:NO|NUMBER|#)\.?\s*[:#\-–]?|\bINV\.?\s*NO\.?\s*[:#\-–]?",
        r"\bBILL\s*(?:NO|NUMBER|#)\.?\s*[:#\-–]?|\bMEMO\s*NO\.?\s*[:#\-–]?",
        r"\b(?:DELIVERY\s+)?CHALLAN\s*(?:NO|NUMBER|#)\.?\s*[:#\-–]?|\bD\.?\s?C\.?\s*NO\.?\s*[:#\-–]?",
    )
]
DATE_LABELS = [
    re.compile(p, re.I)
    for p in (
        r"\b(?:INVOICE|BILL|CHALLAN|D\.?\s?C\.?)\s*DATE\b\.?\s*[:\-–]?",
        r"\bDATED?\b\.?\s*[:\-–]?",
    )
]
# A plain "Date" next to one of these belongs to another document (the PO, an e-invoice receipt).
OTHER_DATE = re.compile(r"(?:\bP\.?\s?O\.?|ORDER|ACK|DUE|DELIVERY|SUPPLY)\s*$", re.I)
DATE_LIKE = re.compile(r"^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$")
MONTHS = {m: i for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], 1)}
QTY_HEADER = re.compile(r"^(?:QTY|QUANTITY|QNTY|QUANT)\b", re.I)
TOTAL_ROW = re.compile(r"\b(?:TOTAL|SUB\s*TOTAL|GRAND)\b", re.I)
# Vision often reads the rupee sign as R, Z, ? or `.
CURRENCY = re.compile(r"^(?:₹|RS\.?|INR|R|Z|\?|`)\s*(?=\d)", re.I)
TAX_LINE = re.compile(r"^(?:ADD\s*[:\-]?\s*)?(?:OUTPUT\s+)?(CGST|SGST|UTGST|IGST)\b", re.I)
GRAND_TOTAL = re.compile(
    r"\b(?:TOTAL\s+(?:INVOICE\s+)?(?:AMOUNT|VALUE)|GRAND\s+TOTAL|NET\s+(?:AMOUNT|PAYABLE|TOTAL)|"
    r"INVOICE\s+(?:TOTAL|VALUE|AMOUNT)|AMOUNT\s+PAYABLE|BILL\s+AMOUNT)\b",
    re.I,
)
TAXABLE_LABEL = re.compile(r"\b(?:TAXABLE\s+(?:VALUE|AMOUNT)|SUB\s*-?\s*TOTAL)\b", re.I)
SELLER_LABEL = re.compile(r"^(?:SOLD\s+BY|SELLER|SUPPLIER|VENDOR)\b\s*[:\-]?\s*", re.I)

# The seller's name is the prominent line at the top that isn't a document title, an address or
# contact line, or the buyer (us).
COMPANY_WORDS = re.compile(
    r"\b(?:LTD|LIMITED|PVT|PRIVATE|LLP|TRADERS?|TRADING|ENTERPRISES?|INDUSTRIES|INDUSTRY|CORPORATION|"
    r"CORP|AGENC(?:Y|IES)|SUPPLIERS?|SUPPLY|COMPANY|CO|SONS|BROTHERS|BROS|STEELS?|CEMENTS?|HARDWARE|"
    r"MATERIALS?|BUILDERS?|ENGINEERING|ENGINEERS|WORKS|CONSTRUCTIONS?|INFRA|MINERALS|CHEMICALS|PAINTS)\b",
    re.I,
)
NOT_A_NAME = re.compile(
    r"\b(?:CHALLAN|INVOICE|BILL\s+OF\s+SUPPLY|ESTIMATE|QUOTATION|ORIGINAL|DUPLICATE|TRIPLICATE|COPY|"
    r"RECIPIENT|TRANSPORTER|GSTIN|GST|PAN|CIN|PHONE|PH|MOB|MOBILE|TEL|FAX|EMAIL|E-MAIL|WEBSITE|WWW|"
    r"ADDRESS|ROAD|RD|STREET|NAGAR|MARG|DIST|DISTRICT|TALUKA|PIN|PINCODE|STATE|CODE|DATE|NO|SUBJECT|"
    r"JURISDICTION|DEALERS?\s+IN|MANUFACTURERS?\s+OF|SPECIALIST|AUTHORISED|AUTHORIZED)\b",
    re.I,
)
BUYER_MARKER = re.compile(r"^(?:TO\b|M/S\b|CONSIGNEE|BUYER|BILL\s+TO|SHIP\s+TO|DELIVER(?:Y|ED)\s+TO|RECEIVER|CUSTOMER)", re.I)
SIGNATURE = re.compile(r"^\s*FOR\s*[,:]?\s*(?:M/?S\.?\s*)?(.{3,})$", re.I)


FIELD_NAMES = (
    "vendor",
    "invoiceNumber",
    "billDate",
    "poNumber",
    "items",
    "item",
    "delivered",
    "taxableAmount",
    "cgst",
    "sgst",
    "igst",
    "totalAmount",
)
ROW_KEYS = ("description", "quantity", "unit", "rate", "amount")
ADDS_UP = 0.95  # the confidence of amounts that check out against each other


def parse_page(page: Page) -> dict:
    """Everything read off a page of positioned words. Each field is {"value", "confidence"} or
    None. "items" is the goods table (a list of rows); "item" and "delivered" are its summary (the
    names, and the total quantity the office compares with the PO)."""
    fields = {key: None for key in FIELD_NAMES}
    if not page.words:
        return fields
    table = _goods_table(page)
    rows = table.rows if table else _rows_without_table(page)

    fields["vendor"] = _vendor(page)
    fields["invoiceNumber"] = _labelled(page, INVOICE_LABELS, _reference)
    fields["billDate"] = _labelled(page, DATE_LABELS, _date, before=OTHER_DATE)
    fields["poNumber"] = _po_number(page)
    if rows:
        fields["items"] = _field(
            [{**{key: row[key] for key in ROW_KEYS}, "confidence": round(row["confidence"], 3)} for row in rows],
            min(row["confidence"] for row in rows),
        )
        named = [row for row in rows if row["description"]]
        if named:
            fields["item"] = _field(", ".join(r["description"] for r in named), min(r["name_confidence"] for r in named))
        counted = [row for row in rows if row["quantity"] is not None]
        if counted:
            total = round(sum(row["quantity"] for row in counted), 3)
            confidence = min(row["quantity_confidence"] for row in counted)
            printed = table.totals.get("qty") if table else None
            if printed is not None and abs(printed[0] - total) > 0.001:
                confidence *= 0.7  # the rows don't add up to the printed total: something was misread
            fields["delivered"] = _field(total, confidence)
    fields.update(_amounts(page, table, rows))
    return fields


def _field(value, confidence):
    return {"value": value, "confidence": round(max(0.0, min(1.0, confidence)), 3)}


def _join(words):
    return "".join(w.text + (" " if w.space_after else "") for w in words).strip()


def _mean_confidence(words):
    return sum(w.confidence for w in words) / len(words) if words else 0.0


def _to_number(text):
    """A quantity: a plain number, not too long to be one."""
    text = text.strip().rstrip(".")
    if not NUMBER.match(text):
        return None
    value = float(text.replace(",", ""))
    # Quantities are counts or weights; a long run of digits is a reference or phone number.
    return value if 0 < value < 1_000_000 else None


def _money(text):
    """An amount of money: "₹1,750.94", "Rs. 711,450.00", "54263.13", "2,000/-"."""
    text = CURRENCY.sub("", text.strip()).rstrip(".").removesuffix("/-")
    if not NUMBER.match(text):
        return None
    return float(text.replace(",", ""))


def _clean(text):
    return re.sub(r"\s+", " ", text).strip(" .,:;-–|")


# ── Labelled values: invoice number, date, PO number ────────────────────────────────────────────


def _words_in_span(line, start, end):
    """The words of a line that make up characters start..end of its text."""
    picked, offset = [], 0
    for w in line.words:
        if offset < end and offset + len(w.text) > start:
            picked.append(w)
        offset += len(w.text) + (1 if w.space_after else 0)
    return picked or line.words


def _reference(text):
    """A document number: the first token, with at least one digit, that isn't a date."""
    token = (text.strip(" :-–#.").split() or [""])[0].strip(".,;:")
    if 2 <= len(token) <= 40 and any(c.isdigit() for c in token) and not DATE_LIKE.match(token):
        return token
    return None


def _date(text):
    """A bill date as YYYY-MM-DD, read day-first (as Indian bills are written)."""
    text = text.strip(" :-–.")
    match = re.match(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b", text)
    if match:
        day, month, year = (int(g) for g in match.groups())
    else:
        match = re.match(r"(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})[\s\-/.,]*(\d{2,4})\b", text)
        if not match or match.group(2)[:3].upper() not in MONTHS:
            return None
        day, month, year = int(match.group(1)), MONTHS[match.group(2)[:3].upper()], int(match.group(3))
    year += 2000 if year < 100 else 0
    try:
        return datetime.date(year, month, day).isoformat()
    except ValueError:
        return None


def _beside(page, label_words, accept):
    """A value printed next to a label rather than after it on the same line: to its right on the
    same row, or just below it ("Invoice No." above "MRL/26-27/158")."""
    lx0, lx1 = min(w.x0 for w in label_words), max(w.x1 for w in label_words)
    ly1 = max(w.y1 for w in label_words)
    lcy = sum(w.cy for w in label_words) / len(label_words)
    h = max(w.h for w in label_words)
    right = [l for l in page.lines if l.x0 >= lx1 - 2 and l.x0 - lx1 < 15 * h and abs(l.cy - lcy) <= 0.9 * h]
    below = [
        l
        for l in page.lines
        if l.y0 >= ly1 - 2 and l.y0 - ly1 <= 2.5 * h and min(l.x1, lx1 + 2 * h) - max(l.x0, lx0 - 2 * h) > 0
    ]
    for line in sorted(right, key=lambda l: l.x0) + sorted(below, key=lambda l: l.y0):
        value = accept(line.text)
        if value:
            return _field(value, line.confidence)
    return None


def _labelled(page, patterns, accept, before=None):
    """The value of the first label (in order of preference) that has one."""
    lines = sorted(page.lines, key=lambda l: (l.y0, l.x0))
    for pattern in patterns:
        for line in lines:
            text = line.text
            for match in pattern.finditer(text):
                if before and before.search(text[: match.start()]):
                    continue
                rest = text[match.end() :]
                value = accept(rest) if rest.strip() else None
                if value:
                    return _field(value, _mean_confidence(_words_in_span(line, match.end(), len(text))))
                found = _beside(page, _words_in_span(line, match.start(), match.end()), accept)
                if found:
                    return found
    return None


def _po_number(page):
    strong = _labelled(page, [PO_STRONG], _reference)
    if strong:
        return strong
    # A PO box printed but left empty means the bill has no PO number, whatever else it says.
    if any(PO_STRONG.search(line.text) for line in page.lines):
        return None
    return _labelled(page, [PO_WEAK], _reference)


# ── The seller ──────────────────────────────────────────────────────────────────────────────────


def _buyer_names():
    return [n.strip().lower() for n in current_app.config.get("OCR_BUYER_NAMES", "").split(",") if n.strip()]


def _vendor(page):
    lines = page.lines
    top, bottom = min(l.y0 for l in lines), max(l.y1 for l in lines)
    span = max(1.0, bottom - top)
    buyer_names = _buyer_names()

    def is_buyer(text):
        lowered = text.lower()
        return any(name in lowered for name in buyer_names)

    def a_name(text):
        text = _clean(text)
        return text if sum(c.isalpha() for c in text) >= 3 and not is_buyer(text) else None

    # "Sold By: Buildingshop.in" names the seller outright.
    for line in sorted(lines, key=lambda l: l.y0):
        match = SELLER_LABEL.match(line.text)
        if match:
            named = a_name(line.text[match.end() :])
            if named:
                return _field(named, line.confidence)
            found = _beside(page, _words_in_span(line, 0, match.end()), a_name)
            if found:
                return found

    # The buyer's block ("To, M/s KH Group …") starts where the seller's header ends.
    buyer_start = min((l.y0 for l in lines if BUYER_MARKER.match(l.text.strip())), default=bottom)
    heights = sorted(l.height for l in lines)
    typical = heights[len(heights) // 2]

    best, best_score = None, 0.0
    for line in lines:
        text = _clean(line.text)
        letters = sum(c.isalpha() for c in text)
        if line.y0 > top + 0.4 * span or line.y0 >= buyer_start or letters < 4 or len(text) > 70:
            continue
        if is_buyer(text) or (NOT_A_NAME.search(text) and not COMPANY_WORDS.search(text)):
            continue
        if sum(c.isdigit() for c in text) > letters / 2:
            continue
        score = line.height / typical + (1.0 if COMPANY_WORDS.search(text) else 0.0) - (line.y0 - top) / span
        if score > best_score:
            best, best_score = (text, line), score

    # "For Shree Ganesh Traders / Authorised Signatory" at the foot names the seller too.
    signed = None
    for line in lines:
        match = SIGNATURE.match(line.text)
        if match and line.y0 > top + 0.5 * span and not is_buyer(match.group(1)):
            signed = (_clean(match.group(1)), line)

    if best and signed and _same_name(best[0], signed[0]):
        # The signature line often has the full name where the logo is shortened or split
        # ("ABS NAVDEEP" over "CONCRETE" at the top, "For ABS NAVDEEP CONCRETE" at the foot).
        fuller = signed if len(signed[0].split()) > len(best[0].split()) else best
        return _field(fuller[0], min(best[1].confidence, fuller[1].confidence))
    if best and COMPANY_WORDS.search(best[0]):
        return _field(best[0], best[1].confidence * 0.9)
    if signed:
        return _field(signed[0], signed[1].confidence * 0.85)
    if best:
        return _field(best[0], best[1].confidence * 0.7)
    return None


def _same_name(a, b):
    tokens_a = set(re.findall(r"[a-z0-9]+", a.lower()))
    tokens_b = set(re.findall(r"[a-z0-9]+", b.lower()))
    if not tokens_a or not tokens_b:
        return False
    return len(tokens_a & tokens_b) / min(len(tokens_a), len(tokens_b)) >= 0.6


# ── The goods table ─────────────────────────────────────────────────────────────────────────────


@dataclass
class Column:
    kind: str
    words: list
    left: float = -math.inf
    right: float = math.inf
    reach: float = math.inf  # how far right text written from this column's left can run

    @property
    def x0(self):
        return min(w.x0 for w in self.words)

    @property
    def x1(self):
        return max(w.x1 for w in self.words)

    def holds(self, word):
        return self.left <= word.cx < self.right


@dataclass
class Table:
    columns: list
    rows: list
    totals: dict  # column kind → (number, confidence) on the table's Total row
    top: float
    bottom: float


def _column_kind(text):
    t = text.upper()
    if re.search(r"\b(?:DESCRIPTION|PARTICULARS|ITEMS?|MATERIALS?|GOODS|PRODUCTS?)\b", t):
        return "desc"
    if re.search(r"\b(?:QTY|QUANTITY|QNTY|QUANT)\b", t):
        return "qty"
    if re.search(r"\b(?:C?GST|SGST|IGST|UTGST|TAX|CESS)\b", t):
        if re.search(r"\bTYPE\b", t):
            return "tax_type"
        if re.search(r"\b(?:AMOUNT|AMT|VALUE)\b", t):
            return "tax_amount"
        return "tax_rate"
    if re.search(r"\b(?:RATE|PRICE|MRP)\b", t):
        return "rate"
    if re.search(r"\b(?:UNIT|UOM|U\.O\.M|PER)\b", t):
        return "unit"
    if re.search(r"\bTOTAL\b", t):
        return "line_total"
    if re.search(r"\b(?:AMOUNT|AMT|VALUE)\b", t):
        return "amount"
    return "other"


def _columns(band, h):
    """The table's columns from its heading words. Headings can be stacked over two lines ("Tax"
    over "Amount", "Unit" over "Price") with columns as close together as words, so words are
    grouped by what they sit over, and only unstacked words next to each other ("Description of
    Goods") are read as one heading."""
    words = sorted(band, key=lambda w: w.x0)
    parent = list(range(len(words)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, a in enumerate(words):
        for j in range(i + 1, len(words)):
            b = words[j]
            overlap = min(a.x1, b.x1) - max(a.x0, b.x0)
            if abs(a.cy - b.cy) > 0.5 * h and overlap > 0.3 * min(a.x1 - a.x0, b.x1 - b.x0):
                parent[find(j)] = find(i)
    groups = {}
    for i, w in enumerate(words):
        groups.setdefault(find(i), []).append(w)
    ordered = sorted(groups.values(), key=lambda g: min(w.x0 for w in g))

    def stacked(group):
        return max(w.cy for w in group) - min(w.cy for w in group) > 0.5 * h

    merged = [ordered[0]] if ordered else []
    for group in ordered[1:]:
        last = merged[-1]
        gap = min(w.x0 for w in group) - max(w.x1 for w in last)
        same_row = abs(sum(w.cy for w in group) / len(group) - sum(w.cy for w in last) / len(last)) <= 0.5 * h
        if not stacked(group) and not stacked(last) and same_row and gap <= 0.6 * h:
            merged[-1] = last + group
        else:
            merged.append(group)

    columns = []
    for group in merged:
        text = _join(sorted(group, key=lambda w: (round(w.cy / h), w.x0)))
        columns.append(Column(_column_kind(text), group))
    for left, right in zip(columns, columns[1:]):
        boundary = (left.x1 + right.x0) / 2
        left.right, right.left = boundary, boundary
        # A description is written from the left and can run on past the middle of the gap, up to
        # the next heading.
        left.reach = max(boundary, right.x0 - 0.3 * h)
    return columns


def _on_row(w, anchor, slope):
    """Whether a word sits on the same table row as `anchor`."""
    return abs(w.cy - (anchor.cy + slope * (w.cx - anchor.cx))) <= 0.75 * max(w.h, anchor.h)


def _goods_table(page):
    """The goods table, found by its Qty heading: one row per quantity under it, each with what
    the other columns say on that row."""
    # A heading is a word on its own ("Qty"), not a label with its value after it ("Qty: 20").
    headings = [w for line in page.lines if not QTY_LABEL.search(line.text) for w in line.words]
    qty_header = next((w for w in headings if QTY_HEADER.match(w.text)), None)
    if not qty_header:
        return None
    h = qty_header.h
    top, bottom = qty_header.y0 - 0.9 * h, qty_header.y1 + 1.0 * h
    columns = _columns([w for w in page.words if top <= w.cy <= bottom], h)
    qty_col = next(c for c in columns if qty_header in c.words)
    qty_col.kind = "qty"
    by_kind = {}
    for column in columns:
        by_kind.setdefault(column.kind, column)
    desc = by_kind.get("desc")
    desc_word = next((w for w in desc.words if DESC_HEADER_WORD.match(w.text)), desc.words[0]) if desc else None

    # Rows run parallel to the heading row, which allows for a slightly tilted photo.
    dx = qty_header.cx - desc_word.cx if desc_word else 0
    slope = (qty_header.cy - desc_word.cy) / dx if abs(dx) > 1 else 0.0

    below = [w for w in page.words if w.cy > bottom and w.cy - bottom < 40 * h]
    total_word = min((w for w in below if TOTAL_ROW.search(w.text)), key=lambda w: w.cy, default=None)
    values = []
    for w in sorted(below, key=lambda w: w.cy):
        if not qty_col.holds(w):
            continue
        if total_word and (w.cy > total_word.cy or _on_row(w, total_word, slope)):
            break
        if _to_number(w.text) is None or (values and _on_row(w, values[-1], slope)):
            continue
        values.append(w)
    if not values:
        return None

    end = total_word.y0 if total_word else values[-1].y1 + 2.5 * h
    # Descriptions printed above the first quantity mean quantities sit mid-row (multi-line rows);
    # otherwise each row starts at its quantity.
    centred = desc is not None and any(
        desc.holds(w) and bottom < w.cy < values[0].y0 - 0.3 * h for w in page.words
    )

    def cell(column, anchor):
        if column is None:
            return []
        return sorted((w for w in page.words if column.holds(w) and _on_row(w, anchor, slope)), key=lambda w: w.x0)

    def money_in(column, anchor):
        """The amount in a column on a row, and how sure the reading is."""
        words = cell(column, anchor)
        if not words:
            return None
        joined = _money("".join(w.text for w in words))
        if joined is not None:
            return joined, _mean_confidence(words)
        # A tall row's description can reach into the cell: take the number nearest the heading.
        numbers = [w for w in words if _money(w.text) is not None]
        if not numbers:
            return None
        best = min(numbers, key=lambda w: (max(0.0, column.x0 - w.x1, w.x0 - column.x1), abs(w.cy - anchor.cy)))
        return _money(best.text), best.confidence

    def amount_in(column, anchor):
        found = money_in(column, anchor)
        return found[0] if found else None

    rows = []
    for i, value in enumerate(values):
        if i == 0:
            lower = bottom
        else:
            lower = (values[i - 1].cy + value.cy) / 2 if centred else value.y0 - 0.3 * h
        if i + 1 < len(values):
            nxt = values[i + 1]
            upper = (value.cy + nxt.cy) / 2 if centred else nxt.y0 - 0.3 * h
        else:
            upper = end
        description, desc_words = _description(page, desc, desc_word, lower, upper)
        unit_words = [w for w in cell(by_kind.get("unit"), value) if _money(w.text) is None]
        if not unit_words:
            # "480 Bags" in the quantity cell itself.
            unit_words = [w for w in cell(qty_col, value) if w is not value and _to_number(w.text) is None][:1]
        rate = money_in(by_kind.get("rate"), value)
        amount = money_in(by_kind.get("amount"), value)
        line_total = money_in(by_kind.get("line_total"), value)
        if amount is None and not any(k.startswith("tax") for k in by_kind):
            amount = line_total  # a single "Total" column with no tax columns is the line amount
        name_confidence = _mean_confidence(desc_words) if desc_words else 0.7
        rows.append(
            {
                "description": description,
                "quantity": _to_number(value.text),
                "unit": _clean(_join(unit_words))[:20] or None,
                "rate": rate and rate[0],
                "amount": amount and amount[0],
                "line_total": line_total and line_total[0],
                "tax_amount": amount_in(by_kind.get("tax_amount"), value),
                "tax_type": _join(cell(by_kind.get("tax_type"), value)).upper(),
                "name_confidence": name_confidence,
                "quantity_confidence": value.confidence,
                # The row as a whole: the office should look again if any of it is uncertain.
                "confidence": min([name_confidence, value.confidence] + [found[1] for found in (rate, amount) if found]),
            }
        )

    totals = {}
    if total_word:
        for kind in ("qty", "amount", "line_total", "tax_amount"):
            column = qty_col if kind == "qty" else by_kind.get(kind)
            found = money_in(column, total_word) if column else None
            if found is not None:
                totals[kind] = found
    return Table(columns=columns, rows=rows, totals=totals, top=top, bottom=end)


DESC_HEADER_WORD = re.compile(r"^(?:DESCRIPTION|PARTICULARS|ITEMS?|MATERIALS?|GOODS|PRODUCTS?)\b", re.I)


def _description(page, desc, desc_word, lower, upper):
    """A row's description: its lines in the Description column between `lower` and `upper`, in
    reading order, without the serial number or an HSN/SAC code line."""
    if desc is None:
        return "", []
    picked, parts = [], []
    for line in sorted(page.lines, key=lambda l: (l.y0, l.x0)):
        words = []
        for w in line.words:
            if not (lower < w.cy < upper and desc.left <= w.cx < desc.reach):
                continue
            # A plain number left of the heading is the row's serial number (the Sr. No. column).
            if w.x1 <= desc_word.x0 and re.fullmatch(r"\(?\d{1,3}[.)]?", w.text):
                continue
            # Past the middle of the gap, a number on its own is the next column's.
            if w.cx >= desc.right and _money(w.text) is not None and not (words and w.x0 - words[-1].x1 <= 0.5 * w.h):
                continue
            words.append(w)
        if not words or re.match(r"(?:HSN|SAC)\b", words[0].text, re.I):
            continue
        picked += words
        parts.append(_join(words))
    text = _clean(" ".join(parts))[:300]
    # Codes like "M-10" (a concrete grade) count as an item; a bare number doesn't.
    if not any(c.isalpha() for c in text):
        return "", []
    return text, picked


def _rows_without_table(page):
    """A bill with no goods table: "Material: River Sand", "Quantity: 3 Brass", or a "480 Bags"
    on a line, as a single row."""
    item = None
    for line in page.lines:
        match = ITEM_LABEL.search(line.text)
        if match:
            text = _clean(QTY_WITH_UNIT.sub("", match.group(1)))
            if sum(c.isalpha() for c in text) >= 2:
                item = (text, line.confidence * 0.9)
                break

    quantity = None
    for line in page.lines:
        match = QTY_LABEL.search(line.text)
        if match and _to_number(match.group(1)):
            unit = QTY_WITH_UNIT.search(line.text[match.start(1) :])
            quantity = (_to_number(match.group(1)), unit.group(2) if unit else None, line.confidence * 0.9)
            break
    if quantity is None:
        for line in page.lines:
            match = QTY_WITH_UNIT.search(line.text)
            if match and _to_number(match.group(1)):
                # A bare "480 Bags" could also be a total or a previous balance: worth a second look.
                quantity = (_to_number(match.group(1)), match.group(2), line.confidence * 0.7)
                before = _clean(line.text[: match.start()])
                if item is None and sum(c.isalpha() for c in before) >= 2:
                    item = (before, line.confidence * 0.7)
                break

    if item is None and quantity is None:
        return []
    confidences = [c for c in (item and item[1], quantity and quantity[2]) if c]
    return [
        {
            "description": item[0] if item else "",
            "quantity": quantity[0] if quantity else None,
            "unit": quantity[1] if quantity else None,
            "rate": None,
            "amount": None,
            "line_total": None,
            "tax_amount": None,
            "tax_type": "",
            "name_confidence": item[1] if item else 0.0,
            "quantity_confidence": quantity[2] if quantity else 0.0,
            "confidence": min(confidences),
        }
    ]


# ── Money: taxable amount, GST, total ───────────────────────────────────────────────────────────


def _amount_beside(page, line, match):
    """The amount printed on the same row as a label, to its right: the right-most number that
    isn't a percentage ("CGST  9.00%  54263.13")."""
    label = _words_in_span(line, match.start(), match.end())
    lx1, lcy = max(w.x1 for w in label), sum(w.cy for w in label) / len(label)
    h = max(w.h for w in label)
    candidates = []
    for w in page.words:
        if w.x0 > lx1 - 1 and abs(w.cy - lcy) <= 1.0 * h and "%" not in w.text:
            value = _money(w.text)
            if value is not None:
                candidates.append((w.x0, value, w.confidence))
    if not candidates:
        return None
    _, value, confidence = max(candidates)
    return _field(value, min(confidence, line.confidence))


def _amounts(page, table, rows):
    found = {"taxableAmount": None, "cgst": None, "sgst": None, "igst": None, "totalAmount": None}
    outside = [l for l in page.lines if not (table and table.top <= l.cy <= table.bottom)]

    for line in outside:
        match = TAX_LINE.match(line.text.strip())
        if match:
            key = {"CGST": "cgst", "SGST": "sgst", "UTGST": "sgst", "IGST": "igst"}[match.group(1).upper()]
            found[key] = found[key] or _amount_beside(page, line, match)
    if table and not any(found[k] for k in ("cgst", "sgst", "igst")):
        # GST as a column of the goods table ("Tax Type: IGST", "Tax Amount: ₹315.18").
        amounts = [r["tax_amount"] for r in rows if r["tax_amount"] is not None]
        types = {r["tax_type"] for r in rows if r["tax_type"]}
        if amounts and types:
            if "tax_amount" in table.totals:
                tax = _field(*table.totals["tax_amount"])
            else:
                tax = _field(round(sum(amounts), 2), min(r["confidence"] for r in rows))
            if all("IGST" in t for t in types):
                found["igst"] = tax
            elif all("CGST" in t or "SGST" in t for t in types):
                # One tax column holding CGST and SGST together: they are always equal halves.
                half = round(tax["value"] / 2, 2)
                found["cgst"] = _field(half, tax["confidence"])
                found["sgst"] = _field(half, tax["confidence"])

    for line in outside:
        match = TAXABLE_LABEL.search(line.text)
        if match:
            found["taxableAmount"] = _amount_beside(page, line, match)
            if found["taxableAmount"]:
                break
    if not found["taxableAmount"] and rows:
        if table and "amount" in table.totals:
            found["taxableAmount"] = _field(*table.totals["amount"])
        elif all(r["amount"] is not None for r in rows):
            found["taxableAmount"] = _field(round(sum(r["amount"] for r in rows), 2), min(r["confidence"] for r in rows) * 0.9)

    # The bill's final total is the lowest such line (after GST and rounding).
    for line in sorted(outside, key=lambda l: l.y0, reverse=True):
        match = GRAND_TOTAL.search(line.text)
        if match:
            found["totalAmount"] = _amount_beside(page, line, match)
            if found["totalAmount"]:
                break
    taxes = [found[k] for k in ("cgst", "sgst", "igst") if found[k]]
    worked_out = False
    if not found["totalAmount"] and rows:
        confidence = min(r["confidence"] for r in rows) * 0.9
        if table and "line_total" in table.totals:
            found["totalAmount"] = _field(*table.totals["line_total"])
        elif table and "line_total" in {c.kind for c in table.columns} and all(r["line_total"] is not None for r in rows):
            found["totalAmount"] = _field(round(sum(r["line_total"] for r in rows), 2), confidence)
        elif found["taxableAmount"] and taxes:
            taxed = found["taxableAmount"]["value"] + sum(t["value"] for t in taxes)
            found["totalAmount"] = _field(round(taxed, 2), confidence * 0.9)
            worked_out = True

    if found["taxableAmount"] and found["totalAmount"] and taxes and not worked_out:
        taxed = found["taxableAmount"]["value"] + sum(t["value"] for t in taxes)
        if abs(taxed - found["totalAmount"]["value"]) <= 1.0:
            # Read separately and adding up (to within the rounding off): very unlikely all misread.
            for f in [found["taxableAmount"], found["totalAmount"], *taxes]:
                f["confidence"] = max(f["confidence"], ADDS_UP)
    return found
