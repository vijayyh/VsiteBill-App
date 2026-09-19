from flask import Blueprint, g, jsonify, request

from ..auth import issue_token, login_required
from ..extensions import db
from ..models import PasswordResetRequest, User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    user = User.query.filter_by(phone=phone).first()
    if user is None or not user.check_password(password):
        return jsonify({"error": "Incorrect phone number or password"}), 401

    return jsonify({"token": issue_token(user), "user": user.to_dict()})


@bp.get("/me")
@login_required
def me():
    return jsonify({"user": g.current_user.to_dict()})


@bp.post("/forgot-password")
def forgot_password():
    """Records a reset request for an admin to action — this app has no SMS/email
    provider, so "forgot password" is admin-mediated rather than self-service."""
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    note = (data.get("note") or "").strip()[:300] or None

    user = User.query.filter_by(phone=phone).first()
    if user is not None:
        existing = PasswordResetRequest.query.filter_by(user_id=user.id, status="PENDING").first()
        if existing is None:
            db.session.add(PasswordResetRequest(user_id=user.id, note=note))
            db.session.commit()

    # Same response whether or not the phone matched an account, so this can't
    # be used to probe which phone numbers have accounts.
    return jsonify(
        {"message": "If that phone number has an account, an admin will be in touch to reset it."}
    )
