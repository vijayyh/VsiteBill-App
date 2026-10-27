from datetime import timedelta

from flask import Blueprint, current_app, g, jsonify, request

from .. import ocr
from ..auth import login_required
from ..extensions import db
from ..models import OcrScan, utcnow

bp = Blueprint("ocr", __name__, url_prefix="/api/ocr")

# Google counts Vision's free 1,000 a month by the Pacific-time month. A fixed UTC-8 starts our
# month at the same moment (PST) or an hour after Google's (PDT), so it never counts a reading
# into a new month that Google still bills to the old one.
GOOGLE_MONTH_OFFSET = timedelta(hours=-8)


@bp.get("/status")
@login_required
def status():
    """Whether this server can read bills, so the form knows whether to try."""
    return jsonify({"enabled": ocr.configured() and not _monthly_limit_reached()})


@bp.post("/bill")
@login_required
def read_bill():
    """Reads a bill photo: the vendor, bill number and date, PO number, the goods table and the
    amounts. The reading is kept (with the bill it becomes, once sent) so it can later be compared
    with what the office confirmed."""
    if not ocr.configured():
        return jsonify({"error": "Reading bills isn't set up on this server"}), 503
    if _monthly_limit_reached():
        return jsonify({"error": "This month's free bill readings are used up. Type the details in."}), 503

    photo = request.files.get("photo")
    data = photo.read() if photo else b""
    if not data:
        return jsonify({"error": "A photo file is required"}), 400

    try:
        reading = ocr.read_bill(data)
    except ocr.OcrError:
        current_app.logger.exception("Reading a bill photo failed")
        return jsonify({"error": "Couldn't read the bill. Type the details in."}), 502

    fields = reading.fields
    scan = OcrScan(
        user_id=g.current_user.id,
        provider=reading.provider,
        text=reading.text,
        # Cut to their columns: a bill with many items gives a long item summary, and Postgres
        # (unlike the local SQLite) refuses text longer than its column.
        vendor=_cut(_value(fields, "vendor"), 200),
        item=_cut(_value(fields, "item"), 300),
        delivered=_value(fields, "delivered"),
        po_number=_cut(_value(fields, "poNumber"), 50),
        confidence={key: f["confidence"] for key, f in fields.items() if f},
        reading=fields,
    )
    db.session.add(scan)
    db.session.commit()
    return jsonify({"scanId": scan.id, "fields": scan.fields(), "lowConfidence": ocr.LOW_CONFIDENCE})


def _monthly_limit_reached():
    """Every kept reading is one Vision charged for; failed calls aren't kept, and aren't charged."""
    google_now = utcnow() + GOOGLE_MONTH_OFFSET
    month_start = google_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - GOOGLE_MONTH_OFFSET
    # created_at is stored as naive UTC.
    used = db.session.query(OcrScan).filter(OcrScan.created_at >= month_start.replace(tzinfo=None)).count()
    return used >= current_app.config["OCR_MONTHLY_LIMIT"]


def _cut(value, limit):
    return value[:limit] if isinstance(value, str) else value


def _value(fields, key):
    found = fields.get(key)
    return found["value"] if found else None
