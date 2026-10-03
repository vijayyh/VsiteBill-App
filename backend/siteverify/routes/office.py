from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify

from .. import drive
from ..auth import login_required, require_role
from ..extensions import db
from ..models import Delivery, Project, drive_folder_url

bp = Blueprint("office", __name__, url_prefix="/api/office")


@bp.get("/drive")
@require_role("accountant", "admin")
def drive_links():
    """Read-only view of the Drive archive: where the bills are, nothing that can
    change the connection (connect/disconnect/Shared Drive stay admin-only)."""
    account = drive.get_account()
    if account is None:
        return jsonify({"connected": False})
    folders = Project.query.filter(Project.drive_folder_id.isnot(None)).all()
    return jsonify(
        {
            "connected": True,
            "email": account.email,
            "sharedDriveName": account.shared_drive_name,
            "rootFolderUrl": drive_folder_url(account.root_folder_id),
            "projectFolderUrls": {p.id: drive_folder_url(p.drive_folder_id) for p in folders},
        }
    )


@bp.get("/stats")
@login_required
def stats():
    pending = Delivery.query.filter_by(status="PENDING").count()
    flagged = Delivery.query.filter_by(status="REVIEW").count()

    # A plain >= / < range on the timestamp column (rather than e.g. SQLite's
    # strftime()) so this query works unchanged on both SQLite (dev) and
    # Postgres (production).
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month_start = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    matched_mtd = Delivery.query.filter(
        Delivery.status == "MATCHED",
        Delivery.uploaded_at >= month_start,
        Delivery.uploaded_at < next_month_start,
    ).count()

    return jsonify(
        {
            "pending": pending,
            "flagged": flagged,
            "matchedThisMonth": matched_mtd,
        }
    )
