import uuid

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy.orm import joinedload
from werkzeug.utils import secure_filename

from .. import bills, drive, notify, ocr, storage
from ..auth import login_required, require_role
from ..extensions import db
from ..models import BillChange, Delivery, OcrScan, Project

bp = Blueprint("deliveries", __name__, url_prefix="/api")

ALLOWED_STATUSES = {"PENDING", "REVIEW", "MATCHED"}
TEXT_FIELDS = {"vendor": "vendor", "item": "item", "poNumber": "po_number", "note": "note"}
NUMBER_FIELDS = ("ordered", "delivered")


def _visible_to_current_user(delivery):
    """Supervisors only ever see the bills they sent themselves."""
    user = g.current_user
    return user.role != "supervisor" or delivery.uploaded_by_id == user.id


@bp.get("/deliveries")
@login_required
def list_deliveries_across_projects():
    """Bills across every project, newest first, each with its project's code/name.
    Supervisors only ever see their own; ?mine=1 narrows anyone else to theirs."""
    user = g.current_user
    query = Delivery.query.options(joinedload(Delivery.project))
    if user.role == "supervisor" or request.args.get("mine") == "1":
        query = query.filter(Delivery.uploaded_by_id == user.id)
    status_param = request.args.get("status")
    if status_param:
        query = query.filter(Delivery.status.in_(status_param.split(",")))

    result = []
    for d in query.order_by(Delivery.uploaded_at.desc()).all():
        data = d.to_dict()
        data["project"] = {"code": d.project.code, "name": d.project.name, "accent": d.project.accent}
        result.append(data)
    return jsonify({"deliveries": result})


@bp.post("/projects/<project_id>/deliveries")
@login_required
def create_delivery(project_id):
    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404

    photo = request.files.get("photo")
    if photo is None or photo.filename == "":
        return jsonify({"error": "A photo file is required"}), 400

    ext = secure_filename(photo.filename).rsplit(".", 1)[-1].lower() if "." in photo.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"

    storage.save_photo(photo, filename)

    # Sending is lenient: a bill can arrive long after it was photographed (from a phone's offline
    # queue), and rejecting it would lose it. A value that can't be read is simply left empty.
    def lenient(read, *args):
        try:
            return read(*args)
        except bills.BillError:
            return None

    form = request.form
    delivery = Delivery(
        project_id=project.id,
        uploaded_by_id=g.current_user.id,
        vendor=form.get("vendor", ""),
        po_number=form.get("poNumber") or None,
        invoice_number=lenient(bills.text, form.get("invoiceNumber"), "invoiceNumber", 60),
        bill_date=lenient(bills.bill_date, form.get("billDate")),
        status="PENDING",
        photo_filename=filename,
    )
    for key, column in bills.AMOUNT_FIELDS.items():
        setattr(delivery, column, lenient(bills.number, form.get(key), key))
    rows = lenient(bills.items, form.get("items")) if form.get("items") else None
    if not rows:
        # A bill from an app without the items table: its one item and quantity become one row.
        delivered = lenient(bills.number, form.get("delivered"), "delivered")
        item = form.get("item", "")
        rows = [{"description": item, "quantity": delivered, "unit": None, "rate": None, "amount": None}]
        rows = rows if item or delivered is not None else []
    bills.apply_items(delivery, rows)
    db.session.add(delivery)
    db.session.flush()  # assigns delivery.id for the notification link
    scan = _attach_ocr_scan(delivery, request.form.get("ocrScanId"))
    db.session.add(
        BillChange(
            delivery_id=delivery.id,
            user_id=g.current_user.id,
            action="sent",
            from_reading=scan is not None,
            # What the supervisor changed from what the photo said (nothing to compare without one).
            changes=bills.differences(bills.reading_values(scan.reading), bills.snapshot(delivery)) if scan else [],
        )
    )
    notify.bill_uploaded(delivery)
    db.session.commit()

    return jsonify({"delivery": delivery.to_dict()}), 201


def _attach_ocr_scan(delivery, scan_id):
    """Links the reading the bill form filled itself in from (if any) to the bill, and marks the
    quantity for a double-check when it was kept as an uncertain reading. Returns the reading."""
    try:
        scan = db.session.get(OcrScan, int(scan_id)) if scan_id else None
    except ValueError:
        return None
    # Only the sender's own, not-yet-used reading: a stray or replayed id changes nothing.
    if scan is None or scan.user_id != delivery.uploaded_by_id or scan.delivery_id is not None:
        return None
    scan.delivery_id = delivery.id
    kept_as_read = scan.delivered is not None and delivery.delivered == scan.delivered
    if kept_as_read and scan.confidence.get("delivered", 0.0) < ocr.LOW_CONFIDENCE:
        delivery.quantity_low_confidence = True
    return scan


@bp.get("/deliveries/<int:delivery_id>/changes")
@require_role("accountant", "admin")
def list_bill_changes(delivery_id):
    """The bill's history, newest first: who sent it (and what they changed from the photo
    reading), and every later save by the office, with each value from → to."""
    delivery = db.session.get(Delivery, delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404
    entries = (
        BillChange.query.filter_by(delivery_id=delivery.id)
        .order_by(BillChange.created_at.desc(), BillChange.id.desc())
        .all()
    )
    return jsonify({"changes": [entry.to_dict() for entry in entries]})


@bp.get("/deliveries/<int:delivery_id>")
@login_required
def get_delivery(delivery_id):
    delivery = db.session.get(Delivery, delivery_id)
    # Same 404 for "not yours" as for "doesn't exist", so ids can't be probed.
    if delivery is None or not _visible_to_current_user(delivery):
        return jsonify({"error": "Delivery not found"}), 404
    return jsonify({"delivery": delivery.to_dict()})


@bp.patch("/deliveries/<int:delivery_id>")
@require_role("accountant", "admin")
def update_delivery(delivery_id):
    """Reviewing a bill (editing it, flagging, matching) is the office's job, not the supervisor's."""
    delivery = db.session.get(Delivery, delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404

    data = request.get_json(silent=True) or {}
    previous_status = delivery.status
    before = bills.snapshot(delivery)

    # Validate everything before changing anything, so a bad field never half-applies.
    try:
        rows = bills.items(data["items"]) if "items" in data else None
        details = {}
        if "invoiceNumber" in data:
            details["invoice_number"] = bills.text(data["invoiceNumber"], "invoiceNumber", 60)
        if "billDate" in data:
            details["bill_date"] = bills.bill_date(data["billDate"])
        for key, column in bills.AMOUNT_FIELDS.items():
            if key in data:
                details[column] = bills.number(data[key], key)
        numbers = {key: bills.number(data[key], key) for key in NUMBER_FIELDS if key in data}
    except bills.BillError as e:
        return jsonify({"error": str(e)}), 400
    for key in TEXT_FIELDS:
        if key in data and data[key] is not None and not isinstance(data[key], str):
            return jsonify({"error": f"{key} must be text"}), 400
    if "status" in data and data["status"] not in ALLOWED_STATUSES:
        return jsonify({"error": "Invalid status"}), 400

    for key, column in TEXT_FIELDS.items():
        if key in data:
            setattr(delivery, column, data[key])
    for key, value in numbers.items():
        setattr(delivery, key, value)
    for column, value in details.items():
        setattr(delivery, column, value)
    if rows is not None:
        bills.apply_items(delivery, rows)
    elif ("item" in data or "delivered" in numbers) and len(delivery.items) <= 1:
        # An app without the items table edited the one item: keep its row in step.
        row = delivery.items[0].to_dict() if delivery.items else {"unit": None, "rate": None, "amount": None}
        row.update(description=delivery.item, quantity=delivery.delivered)
        bills.apply_items(delivery, [row] if delivery.item or delivery.delivered is not None else [])
    if rows is not None or "delivered" in numbers:
        delivery.quantity_low_confidence = False  # the office has now checked the quantity itself
    if "status" in data:
        delivery.status = data["status"]

    changes = bills.differences(before, bills.snapshot(delivery))
    if changes:
        db.session.add(
            BillChange(delivery_id=delivery.id, user_id=g.current_user.id, action="edited", changes=changes)
        )
    if delivery.status != previous_status:
        notify.bill_status_changed(delivery, g.current_user)
    db.session.commit()
    return jsonify({"delivery": delivery.to_dict()})


@bp.post("/deliveries/<int:delivery_id>/save-to-drive")
@require_role("accountant", "admin")
def save_delivery_to_drive(delivery_id):
    delivery = db.session.get(Delivery, delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404
    if delivery.drive_file_id:
        return jsonify({"error": "This delivery is already saved to Drive", "delivery": delivery.to_dict()}), 409

    project = db.session.get(Project, delivery.project_id)

    try:
        delivery = drive.upload_delivery_photo(project, delivery)
    except drive.DriveNotConnected:
        return jsonify({"error": "No Google account is connected yet — ask an admin to connect one"}), 409
    except FileNotFoundError:
        return jsonify({"error": "The original photo file is missing on the server"}), 500
    except Exception as exc:  # Google API errors, network issues, etc.
        current_app.logger.exception("Drive upload failed")
        return jsonify({"error": f"Could not save to Drive: {exc}"}), 502

    return jsonify({"delivery": delivery.to_dict()})
