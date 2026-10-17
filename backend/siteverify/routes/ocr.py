from flask import Blueprint, current_app, g, jsonify, request

from .. import ocr
from ..auth import login_required
from ..extensions import db
from ..models import OcrScan

bp = Blueprint("ocr", __name__, url_prefix="/api/ocr")


@bp.get("/status")
@login_required
def status():
    """Whether this server can read bills, so the form knows whether to try."""
    return jsonify({"enabled": ocr.configured()})


@bp.post("/bill")
@login_required
def read_bill():
    """Reads a bill photo: the vendor, bill number and date, PO number, the goods table and the
    amounts. The reading is kept (with the bill it becomes, once sent) so it can later be compared
    with what the office confirmed."""
    if not ocr.configured():
        return jsonify({"error": "Reading bills isn't set up on this server"}), 503

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
        vendor=_value(fields, "vendor"),
        item=_value(fields, "item"),
        delivered=_value(fields, "delivered"),
        po_number=_value(fields, "poNumber"),
        confidence={key: f["confidence"] for key, f in fields.items() if f},
        reading=fields,
    )
    db.session.add(scan)
    db.session.commit()
    return jsonify({"scanId": scan.id, "fields": scan.fields(), "lowConfidence": ocr.LOW_CONFIDENCE})


def _value(fields, key):
    found = fields.get(key)
    return found["value"] if found else None
