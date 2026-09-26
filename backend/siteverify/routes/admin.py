from flask import Blueprint, current_app, g, jsonify, redirect, request

from .. import drive
from ..auth import generate_password, require_role
from ..extensions import db
from ..models import Delivery, PasswordResetRequest, Project, User, utcnow

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

VALID_ROLES = {"supervisor", "accountant", "admin"}
VALID_ACCENTS = {"accent", "forest", "clay"}


@bp.get("/overview")
@require_role("admin")
def overview():
    return jsonify(
        {
            "userCounts": {
                "supervisor": User.query.filter_by(role="supervisor").count(),
                "accountant": User.query.filter_by(role="accountant").count(),
                "admin": User.query.filter_by(role="admin").count(),
            },
            "projectCount": Project.query.count(),
            "deliveryCount": Delivery.query.count(),
            "pendingPasswordResets": PasswordResetRequest.query.filter_by(status="PENDING").count(),
        }
    )


@bp.get("/deliveries")
@require_role("admin")
def list_all_deliveries():
    deliveries = Delivery.query.order_by(Delivery.uploaded_at.desc()).all()
    result = []
    for d in deliveries:
        data = d.to_dict()
        data["project"] = {"code": d.project.code, "name": d.project.name, "accent": d.project.accent}
        result.append(data)
    return jsonify({"deliveries": result})


@bp.get("/users")
@require_role("admin")
def list_users():
    users = User.query.order_by(User.role, User.name).all()
    result = []
    for user in users:
        data = user.to_admin_dict()
        data["projectsUploadedTo"] = (
            db.session.query(Delivery.project_id).filter_by(uploaded_by_id=user.id).distinct().count()
        )
        data["deliveryCount"] = Delivery.query.filter_by(uploaded_by_id=user.id).count()
        result.append(data)
    return jsonify({"users": result})


@bp.post("/users")
@require_role("admin")
def create_user():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    role = data.get("role")
    initials = "".join(part[0].upper() for part in name.split()[:2]) or "?"

    if not name or not phone:
        return jsonify({"error": "Name and phone number are required"}), 400
    if role not in VALID_ROLES:
        return jsonify({"error": f"Role must be one of {', '.join(sorted(VALID_ROLES))}"}), 400
    if User.query.filter_by(phone=phone).first() is not None:
        return jsonify({"error": "A user with that phone number already exists"}), 409

    password = generate_password()
    user = User(name=name, initials=initials, phone=phone, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"user": user.to_admin_dict(), "temporaryPassword": password}), 201


@bp.post("/users/<int:user_id>/reset-password")
@require_role("admin")
def reset_user_password(user_id):
    user = User.query.get(user_id)
    if user is None:
        return jsonify({"error": "User not found"}), 404

    password = generate_password()
    user.set_password(password)
    db.session.commit()
    return jsonify({"temporaryPassword": password})


@bp.get("/password-resets")
@require_role("admin")
def list_password_resets():
    status = request.args.get("status", "PENDING")
    query = PasswordResetRequest.query
    if status != "all":
        query = query.filter_by(status=status)
    requests_ = query.order_by(PasswordResetRequest.created_at.desc()).all()
    return jsonify({"requests": [r.to_dict() for r in requests_]})


@bp.post("/password-resets/<int:request_id>/resolve")
@require_role("admin")
def resolve_password_reset(request_id):
    reset_request = PasswordResetRequest.query.get(request_id)
    if reset_request is None:
        return jsonify({"error": "Request not found"}), 404
    if reset_request.status == "RESOLVED":
        return jsonify({"error": "Already resolved"}), 409

    password = generate_password()
    reset_request.user.set_password(password)
    reset_request.status = "RESOLVED"
    reset_request.resolved_at = utcnow()
    reset_request.resolved_by_id = g.current_user.id
    db.session.commit()

    return jsonify({"temporaryPassword": password, "request": reset_request.to_dict()})


@bp.post("/projects")
@require_role("admin")
def create_project():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    name = (data.get("name") or "").strip()
    accent = data.get("accent", "accent")

    if not code or not name:
        return jsonify({"error": "Project code and name are required"}), 400
    if accent not in VALID_ACCENTS:
        accent = "accent"

    project_id = code.lower().replace(" ", "-")
    if Project.query.get(project_id) is not None or Project.query.filter_by(code=code).first() is not None:
        return jsonify({"error": "A project with that code already exists"}), 409

    project = Project(id=project_id, code=code, name=name, accent=accent)
    db.session.add(project)
    db.session.commit()

    try:
        drive.ensure_project_folder_now(project)
    except Exception:
        # Project creation itself must not fail just because Drive is briefly
        # unreachable — the folder gets created lazily on the first "Save to
        # Drive" for this project if this eager attempt doesn't go through.
        current_app.logger.exception("Could not eagerly create Drive folder for new project")

    return jsonify({"project": project.to_dict()}), 201


@bp.patch("/projects/<project_id>")
@require_role("admin")
def update_project(project_id):
    project = Project.query.get(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data and data["name"].strip():
        project.name = data["name"].strip()
    if "accent" in data and data["accent"] in VALID_ACCENTS:
        project.accent = data["accent"]

    db.session.commit()
    return jsonify({"project": project.to_dict()})


@bp.get("/drive/status")
@require_role("admin")
def drive_status():
    account = drive.get_account()
    configured = bool(current_app.config["GOOGLE_CLIENT_ID"] and current_app.config["GOOGLE_CLIENT_SECRET"])
    return jsonify(
        {
            "configured": configured,
            "connected": account is not None,
            "account": account.to_dict() if account else None,
        }
    )


@bp.get("/drive/connect")
@require_role("admin")
def drive_connect():
    if not (current_app.config["GOOGLE_CLIENT_ID"] and current_app.config["GOOGLE_CLIENT_SECRET"]):
        return jsonify({"error": "Google Drive credentials are not configured on the server yet"}), 400
    url = drive.get_authorization_url(admin_id=g.current_user.id)
    return jsonify({"authUrl": url})


@bp.get("/drive/callback")
def drive_callback():
    # Google redirects the admin's browser here directly — no Authorization
    # header available. Which admin gets credited, and the PKCE code_verifier
    # needed to complete the exchange, both travel via the DriveOAuthState row
    # that /drive/connect stashed, keyed by this "state" value.
    code = request.args.get("code")
    state = request.args.get("state")
    frontend_url = current_app.config["FRONTEND_URL"]

    if not code or not state:
        return redirect(f"{frontend_url}/admin?drive=error")

    try:
        drive.exchange_code(code, state)
    except Exception:
        current_app.logger.exception("Google Drive connect failed")
        return redirect(f"{frontend_url}/admin?drive=error")

    return redirect(f"{frontend_url}/admin?drive=connected")


@bp.post("/drive/disconnect")
@require_role("admin")
def drive_disconnect():
    drive.disconnect()
    return jsonify({"ok": True})


@bp.get("/drive/shared-drives")
@require_role("admin")
def drive_shared_drives():
    try:
        drives = drive.list_shared_drives()
    except drive.DriveNotConnected:
        return jsonify({"error": "Connect a Google account first"}), 409
    return jsonify({"sharedDrives": [{"id": d["id"], "name": d["name"]} for d in drives]})


@bp.post("/drive/shared-drive")
@require_role("admin")
def drive_set_shared_drive():
    data = request.get_json(silent=True) or {}
    drive_id = data.get("id") or None
    name = data.get("name") or None
    try:
        account = drive.set_shared_drive(drive_id, name)
    except drive.DriveNotConnected:
        return jsonify({"error": "Connect a Google account first"}), 409
    return jsonify({"account": account.to_dict()})
