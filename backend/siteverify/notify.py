"""Creating in-app notifications. Callers add them to the session and commit
alongside the change that caused them, so an alert never exists for an action
that didn't happen."""

from .extensions import db
from .models import Delivery, Notification, User


def _add(users, kind: str, title: str, body: str | None = None, link: str | None = None) -> None:
    for user in users:
        db.session.add(Notification(user_id=user.id, kind=kind, title=title, body=body, link=link))


def bill_uploaded(delivery: Delivery) -> None:
    uploader = delivery.uploaded_by
    project = delivery.project
    _add(
        User.query.filter_by(role="accountant").all(),
        "bill_new",
        f"New bill from {uploader.name if uploader else 'a supervisor'}",
        f"{project.code} · {delivery.vendor or 'Vendor not entered'}",
        f"/accountant/projects/{project.id}/review/{delivery.id}",
    )


def bill_status_changed(delivery: Delivery, changed_by: User) -> None:
    """Tell whoever sent the bill that the office flagged or matched it."""
    uploader = delivery.uploaded_by
    if uploader is None or uploader.id == changed_by.id or delivery.status not in ("REVIEW", "MATCHED"):
        return
    vendor = delivery.vendor or "your bill"
    if delivery.status == "REVIEW":
        kind, title = "bill_flagged", f"Bill flagged: {vendor}"
        body = delivery.note or f"{delivery.project.code} · the office needs a follow-up"
    else:
        kind, title = "bill_matched", f"Bill matched: {vendor}"
        body = f"{delivery.project.code} · checked against the purchase order"
    link = f"/supervisor/projects/{delivery.project_id}" if uploader.role == "supervisor" else None
    _add([uploader], kind, title, body, link)


def password_reset_requested(user: User) -> None:
    _add(
        User.query.filter_by(role="admin").all(),
        "password_reset",
        f"{user.name} asked for a password reset",
        f"{user.phone} · {user.role}",
        "/admin",
    )
