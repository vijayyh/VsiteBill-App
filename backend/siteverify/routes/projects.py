from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from ..auth import login_required
from ..models import Delivery, Project

bp = Blueprint("projects", __name__, url_prefix="/api/projects")


@bp.get("")
@login_required
def list_projects():
    projects = Project.query.order_by(Project.code).all()
    result = []
    for p in projects:
        data = p.to_dict()
        data["toReview"] = p.deliveries.filter(Delivery.status.in_(["REVIEW", "PENDING"])).count()
        result.append(data)
    return jsonify({"projects": result})


@bp.get("/<project_id>")
@login_required
def get_project(project_id):
    project = Project.query.get(project_id)
    if project is None:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"project": project.to_dict()})


@bp.get("/<project_id>/deliveries")
@login_required
def list_deliveries(project_id):
    project = Project.query.get(project_id)
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
