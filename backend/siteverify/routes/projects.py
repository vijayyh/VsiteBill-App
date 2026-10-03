from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from ..auth import login_required
from ..extensions import db
from ..models import Delivery, Project

bp = Blueprint("projects", __name__, url_prefix="/api/projects")


@bp.get("")
@login_required
def list_projects():
    counts = {
        (project_id, status): n
        for project_id, status, n in db.session.query(Delivery.project_id, Delivery.status, func.count())
        .group_by(Delivery.project_id, Delivery.status)
        .all()
    }
    result = []
    for p in Project.query.order_by(Project.code).all():
        data = p.to_dict()
        data["pendingCount"] = counts.get((p.id, "PENDING"), 0)
        data["flaggedCount"] = counts.get((p.id, "REVIEW"), 0)
        data["matchedCount"] = counts.get((p.id, "MATCHED"), 0)
        result.append(data)
    return jsonify({"projects": result})


@bp.get("/<project_id>")
@login_required
def get_project(project_id):
    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"project": project.to_dict()})


@bp.get("/<project_id>/deliveries")
@login_required
def list_deliveries(project_id):
    project = db.session.get(Project, project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404

    query = Delivery.query.filter_by(project_id=project_id)

    status_param = request.args.get("status")
    if status_param:
        query = query.filter(Delivery.status.in_(status_param.split(",")))

    if request.args.get("uploadedByMe") == "1":
        query = query.filter_by(uploaded_by_id=g.current_user.id)

    if request.args.get("today") == "1":
        today = datetime.now(timezone.utc).date()
        query = query.filter(func.date(Delivery.uploaded_at) == today)

    deliveries = query.order_by(Delivery.uploaded_at.desc()).all()
    return jsonify({"deliveries": [d.to_dict() for d in deliveries]})
