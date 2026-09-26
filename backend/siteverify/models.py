from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    initials = db.Column(db.String(4), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'supervisor' | 'accountant' | 'admin'
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "initials": self.initials,
            "role": self.role,
        }

    def to_admin_dict(self):
        return {
            **self.to_dict(),
            "phone": self.phone,
            "createdAt": self.created_at.isoformat(),
        }


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.String(20), primary_key=True)  # e.g. "kh-014"
    code = db.Column(db.String(30), unique=True, nullable=False)  # e.g. "KH-PRJ-014"
    name = db.Column(db.String(200), nullable=False)
    accent = db.Column(db.String(10), nullable=False, default="accent")

    drive_folder_id = db.Column(db.String(100), nullable=True)
    drive_next_sequence = db.Column(db.Integer, nullable=False, default=1)

    deliveries = db.relationship("Delivery", backref="project", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "accent": self.accent,
        }


class Delivery(db.Model):
    __tablename__ = "deliveries"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.String(20), db.ForeignKey("projects.id"), nullable=False)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    vendor = db.Column(db.String(200), nullable=False, default="")
    item = db.Column(db.String(300), nullable=False, default="")
    status = db.Column(db.String(20), nullable=False, default="PENDING")  # PENDING | REVIEW | MATCHED

    po_number = db.Column(db.String(50), nullable=True)
    ordered = db.Column(db.Float, nullable=True)
    delivered = db.Column(db.Float, nullable=True)
    quantity_low_confidence = db.Column(db.Boolean, nullable=False, default=False)
    note = db.Column(db.Text, nullable=True)

    photo_filename = db.Column(db.String(255), nullable=True)
    uploaded_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    drive_file_id = db.Column(db.String(100), nullable=True)
    drive_web_view_link = db.Column(db.String(500), nullable=True)
    drive_synced_at = db.Column(db.DateTime, nullable=True)

    uploaded_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "projectId": self.project_id,
            "vendor": self.vendor,
            "item": self.item,
            "status": self.status,
            "poNumber": self.po_number,
            "ordered": self.ordered,
            "delivered": self.delivered,
            "quantityLowConfidence": self.quantity_low_confidence,
            "note": self.note,
            "photoUrl": f"/uploads/{self.photo_filename}" if self.photo_filename else None,
            "uploadedBy": self.uploaded_by.name if self.uploaded_by else None,
            "uploadedAt": self.uploaded_at.isoformat(),
            "driveFileId": self.drive_file_id,
            "driveWebViewLink": self.drive_web_view_link,
            "driveSyncedAt": self.drive_synced_at.isoformat() if self.drive_synced_at else None,
        }


class PasswordResetRequest(db.Model):
    __tablename__ = "password_reset_requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="PENDING")  # PENDING | RESOLVED
    note = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    user = db.relationship("User", foreign_keys=[user_id])
    resolved_by = db.relationship("User", foreign_keys=[resolved_by_id])

    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "note": self.note,
            "createdAt": self.created_at.isoformat(),
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
            "user": {
                "id": self.user.id,
                "name": self.user.name,
                "phone": self.user.phone,
                "role": self.user.role,
            },
            "resolvedBy": self.resolved_by.name if self.resolved_by else None,
        }


class GoogleDriveAccount(db.Model):
    """Single-row table: the one Google account the admin has connected for Drive
    sync. Every accountant's "Save to Drive" writes through this same account —
    there's no per-user Google login here, by design (see the app's Drive-sync plan)."""

    __tablename__ = "google_drive_account"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False)
    refresh_token = db.Column(db.Text, nullable=False)
    root_folder_id = db.Column(db.String(100), nullable=True)
    shared_drive_id = db.Column(db.String(100), nullable=True)
    shared_drive_name = db.Column(db.String(255), nullable=True)
    connected_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    connected_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    connected_by = db.relationship("User")

    def to_dict(self):
        return {
            "email": self.email,
            "connectedBy": self.connected_by.name if self.connected_by else None,
            "connectedAt": self.connected_at.isoformat(),
            "sharedDriveId": self.shared_drive_id,
            "sharedDriveName": self.shared_drive_name,
            "rootFolderUrl": (
                f"https://drive.google.com/drive/folders/{self.root_folder_id}"
                if self.root_folder_id
                else None
            ),
        }


class DriveOAuthState(db.Model):
    """Short-lived handoff row bridging the two separate HTTP requests in the
    OAuth dance (/drive/connect and /drive/callback): carries the PKCE code
    verifier and which admin started the flow, keyed by the random "state"
    value round-tripped through Google. Rows are deleted as soon as they're
    consumed."""

    __tablename__ = "drive_oauth_state"

    state = db.Column(db.String(64), primary_key=True)
    code_verifier = db.Column(db.String(255), nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
