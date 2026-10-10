from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


def drive_folder_url(folder_id):
    return f"https://drive.google.com/drive/folders/{folder_id}" if folder_id else None


def iso_utc(dt):
    # Timestamps are written in UTC but the DateTime columns are timezone-naive,
    # so they read back without an offset — and a browser parses an offset-less
    # ISO string as *local* time (5h30m off in IST). Mark them as UTC explicitly.
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


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
            "createdAt": iso_utc(self.created_at),
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
    __table_args__ = (
        # Every gallery query is "this project's bills, newest first".
        db.Index("ix_deliveries_project_uploaded_at", "project_id", "uploaded_at"),
        db.Index("ix_deliveries_uploaded_by_id", "uploaded_by_id"),
        db.Index("ix_deliveries_status", "status"),
    )

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

    # What the bill itself says beyond its goods (all optional; any bill format).
    invoice_number = db.Column(db.String(60), nullable=True)  # invoice / bill / challan no.
    bill_date = db.Column(db.Date, nullable=True)
    taxable_amount = db.Column(db.Float, nullable=True)
    cgst = db.Column(db.Float, nullable=True)
    sgst = db.Column(db.Float, nullable=True)
    igst = db.Column(db.Float, nullable=True)
    total_amount = db.Column(db.Float, nullable=True)

    photo_filename = db.Column(db.String(255), nullable=True)
    uploaded_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    drive_file_id = db.Column(db.String(100), nullable=True)
    drive_web_view_link = db.Column(db.String(500), nullable=True)
    drive_synced_at = db.Column(db.DateTime, nullable=True)

    uploaded_by = db.relationship("User")
    # The goods on the bill, one row each. `item` and `delivered` above are their summary (names
    # and total quantity), which the lists show and the office compares with the PO.
    items = db.relationship(
        "DeliveryItem", order_by="DeliveryItem.position", cascade="all, delete-orphan", lazy="selectin"
    )

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
            "uploadedAt": iso_utc(self.uploaded_at),
            "driveFileId": self.drive_file_id,
            "driveWebViewLink": self.drive_web_view_link,
            "driveSyncedAt": iso_utc(self.drive_synced_at),
            "items": [i.to_dict() for i in self.items],
            "invoiceNumber": self.invoice_number,
            "billDate": self.bill_date.isoformat() if self.bill_date else None,
            "taxableAmount": self.taxable_amount,
            "cgst": self.cgst,
            "sgst": self.sgst,
            "igst": self.igst,
            "totalAmount": self.total_amount,
        }


class DeliveryItem(db.Model):
    """One line of goods on a bill."""

    __tablename__ = "delivery_items"

    id = db.Column(db.Integer, primary_key=True)
    delivery_id = db.Column(db.Integer, db.ForeignKey("deliveries.id"), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False, default=0)
    description = db.Column(db.String(300), nullable=False, default="")
    quantity = db.Column(db.Float, nullable=True)
    unit = db.Column(db.String(20), nullable=True)
    rate = db.Column(db.Float, nullable=True)
    amount = db.Column(db.Float, nullable=True)

    def to_dict(self):
        return {
            "description": self.description,
            "quantity": self.quantity,
            "unit": self.unit,
            "rate": self.rate,
            "amount": self.amount,
        }


class OcrScan(db.Model):
    """One reading of a bill photo, kept next to the bill it became (if it was sent), so what the
    OCR read can be compared with what the office finally confirmed: every matched bill is a
    labelled example for tuning or training a reader later."""

    __tablename__ = "ocr_scans"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    delivery_id = db.Column(db.Integer, db.ForeignKey("deliveries.id"), nullable=True, index=True)
    provider = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    text = db.Column(db.Text, nullable=False, default="")  # everything the reader found on the photo
    vendor = db.Column(db.String(200), nullable=True)
    item = db.Column(db.String(300), nullable=True)
    delivered = db.Column(db.Float, nullable=True)
    po_number = db.Column(db.String(50), nullable=True)
    confidence = db.Column(db.JSON, nullable=False, default=dict)  # {"vendor": 0.97, …}
    reading = db.Column(db.JSON, nullable=False, default=dict)  # everything read, as the bill form gets it

    def fields(self):
        """The reading as the bill form uses it: {"vendor": {"value", "confidence"} | None, …}."""
        return self.reading


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
            "createdAt": iso_utc(self.created_at),
            "resolvedAt": iso_utc(self.resolved_at),
            "user": {
                "id": self.user.id,
                "name": self.user.name,
                "phone": self.user.phone,
                "role": self.user.role,
            },
            "resolvedBy": self.resolved_by.name if self.resolved_by else None,
        }


class Notification(db.Model):
    """An in-app alert for one user (shown on the Alerts tab, counted on the bell)."""

    __tablename__ = "notifications"
    __table_args__ = (db.Index("ix_notifications_user_created_at", "user_id", "created_at"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    kind = db.Column(db.String(30), nullable=False)  # bill_new | bill_flagged | bill_matched | password_reset
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.String(300), nullable=True)
    link = db.Column(db.String(200), nullable=True)  # an in-app path to open when tapped
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    read_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "body": self.body,
            "link": self.link,
            "createdAt": iso_utc(self.created_at),
            "read": self.read_at is not None,
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
            "connectedAt": iso_utc(self.connected_at),
            "sharedDriveId": self.shared_drive_id,
            "sharedDriveName": self.shared_drive_name,
            "rootFolderUrl": drive_folder_url(self.root_folder_id),
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
