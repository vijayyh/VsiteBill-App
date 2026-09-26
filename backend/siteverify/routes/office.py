from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify

from ..auth import login_required
from ..extensions import db
from ..models import Delivery

bp = Blueprint("office", __name__, url_prefix="/api/office")


@bp.get("/stats")
@login_required
def stats():
    to_review = Delivery.query.filter(Delivery.status.in_(["REVIEW", "PENDING"])).count()
    discrepancies = Delivery.query.filter_by(status="REVIEW").count()

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
            "toReview": to_review,
            "discrepancies": discrepancies,
            "matchedMTD": matched_mtd,
        }
    )
