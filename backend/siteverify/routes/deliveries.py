import uuid

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.utils import secure_filename

from .. import drive
from ..auth import login_required
from ..extensions import db
from ..models import Delivery, Project

bp = Blueprint("deliveries", __name__, url_prefix="/api")

ALLOWED_STATUSES = {"PENDING", "REVIEW", "MATCHED"}


@bp.post("/projects/<project_id>/deliveries")
@login_required
def create_delivery(project_id):
    project = Project.query.get(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404

    photo = request.files.get("photo")
    if photo is None or photo.filename == "":
        return jsonify({"error": "A photo file is required"}), 400

    ext = secure_filename(photo.filename).rsplit(".", 1)[-1].lower() if "." in photo.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"

    upload_dir = current_app.config["UPLOAD_DIR"]
    upload_dir.mkdir(parents=True, exist_ok=True)
    photo.save(upload_dir / filename)

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
    db.session.commit()

    return jsonify({"delivery": delivery.to_dict()}), 201


@bp.get("/deliveries/<int:delivery_id>")
@login_required
def get_delivery(delivery_id):
    delivery = Delivery.query.get(delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404
    return jsonify({"delivery": delivery.to_dict()})


@bp.patch("/deliveries/<int:delivery_id>")
@login_required
def update_delivery(delivery_id):
    delivery = Delivery.query.get(delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404

    data = request.get_json(silent=True) or {}

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

    db.session.commit()
    return jsonify({"delivery": delivery.to_dict()})


@bp.post("/deliveries/<int:delivery_id>/save-to-drive")
@login_required
def save_delivery_to_drive(delivery_id):
    delivery = Delivery.query.get(delivery_id)
    if delivery is None:
        return jsonify({"error": "Delivery not found"}), 404
    if delivery.drive_file_id:
        return jsonify({"error": "This delivery is already saved to Drive", "delivery": delivery.to_dict()}), 409

    project = Project.query.get(delivery.project_id)

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
