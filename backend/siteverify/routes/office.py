from datetime import datetime, timezone

from flask import Blueprint, jsonify
from sqlalchemy import func

from ..auth import login_required
from ..extensions import db
from ..models import Delivery

bp = Blueprint("office", __name__, url_prefix="/api/office")


@bp.get("/stats")
@login_required
def stats():
    to_review = Delivery.query.filter(Delivery.status.in_(["REVIEW", "PENDING"])).count()
    discrepancies = Delivery.query.filter_by(status="REVIEW").count()

    now = datetime.now(timezone.utc)
    matched_mtd = Delivery.query.filter(
        Delivery.status == "MATCHED",
        func.strftime("%Y-%m", Delivery.uploaded_at) == now.strftime("%Y-%m"),
    ).count()

    return jsonify(
        {
            "toReview": to_review,
            "discrepancies": discrepancies,
            "matchedMTD": matched_mtd,
        }
    )
