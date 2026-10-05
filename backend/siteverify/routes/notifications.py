from flask import Blueprint, g, jsonify

from ..auth import login_required
from ..extensions import db
from ..models import Notification, utcnow

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")

LIST_LIMIT = 50


def _mine():
    return Notification.query.filter_by(user_id=g.current_user.id)


@bp.get("")
@login_required
def list_notifications():
    items = _mine().order_by(Notification.created_at.desc(), Notification.id.desc()).limit(LIST_LIMIT).all()
    unread = _mine().filter(Notification.read_at.is_(None)).count()
    return jsonify({"notifications": [n.to_dict() for n in items], "unreadCount": unread})


@bp.get("/unread-count")
@login_required
def unread_count():
    return jsonify({"count": _mine().filter(Notification.read_at.is_(None)).count()})


@bp.post("/read-all")
@login_required
def read_all():
    _mine().filter(Notification.read_at.is_(None)).update({Notification.read_at: utcnow()})
    db.session.commit()
    return jsonify({"count": 0})


@bp.post("/<int:notification_id>/read")
@login_required
def read_one(notification_id):
    notification = _mine().filter_by(id=notification_id).first()
    if notification is None:
        return jsonify({"error": "Notification not found"}), 404
    if notification.read_at is None:
        notification.read_at = utcnow()
        db.session.commit()
    return jsonify({"notification": notification.to_dict()})
