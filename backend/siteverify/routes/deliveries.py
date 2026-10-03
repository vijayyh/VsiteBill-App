import uuid

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy.orm import joinedload
from werkzeug.utils import secure_filename

from .. import drive, notify, storage
from ..auth import login_required
from ..extensions import db
from ..models import Delivery, Project

bp = Blueprint("deliveries", __name__, url_prefix="/api")

ALLOWED_STATUSES = {"PENDING", "REVIEW", "MATCHED"}


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

    def form_float(key):
        raw = request.form.get(key)
        try:
            return float(raw) if raw not in (None, "") else None
        except ValueError:
            return None

    delivery = Delivery(
        project_id=project.id,
        uploaded_by_id=g.current_user.id,
        vendor=request.form.get("vendor", ""),
        item=request.form.get("item", ""),
        po_number=request.form.get("poNumber") or None,
        delivered=form_float("delivered"),
        status="PENDING",
        photo_filename=filename,
    )
    db.session.add(delivery)
    db.session.flush()  # assigns delivery.id for the notification link
    notify.bill_uploaded(delivery)
    db.session.commit()

    return jsonify({"delivery": delivery.to_dict()}), 201


@bp.get("/deliveries/<int:delivery_id>")
@login_required
def get_delivery(delivery_id):
    delivery = db.session.get(Delivery, delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404
    return jsonify({"delivery": delivery.to_dict()})


@bp.patch("/deliveries/<int:delivery_id>")
@login_required
def update_delivery(delivery_id):
    delivery = db.session.get(Delivery, delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404

    data = request.get_json(silent=True) or {}
    previous_status = delivery.status

    if "vendor" in data:
        delivery.vendor = data["vendor"]
    if "item" in data:
        delivery.item = data["item"]
    if "poNumber" in data:
        delivery.po_number = data["poNumber"]
    if "ordered" in data:
        delivery.ordered = data["ordered"]
    if "delivered" in data:
        delivery.delivered = data["delivered"]
    if "note" in data:
        delivery.note = data["note"]
    if "status" in data:
        if data["status"] not in ALLOWED_STATUSES:
            return jsonify({"error": "Invalid status"}), 400
        delivery.status = data["status"]

    if delivery.status != previous_status:
        notify.bill_status_changed(delivery, g.current_user)
    db.session.commit()
    return jsonify({"delivery": delivery.to_dict()})


@bp.post("/deliveries/<int:delivery_id>/save-to-drive")
@login_required
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
