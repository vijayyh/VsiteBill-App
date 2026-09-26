"""Google Drive sync: one admin-connected account, a root folder, one
subfolder per project, and sequentially-numbered bill photos inside each.

Deliberately uses the `drive.file` scope only — this app can see and manage
just the files/folders it creates itself, nothing else in the connected
account's Drive. No per-accountant Google login: every "Save to Drive" click,
regardless of which accountant is logged in, writes through the single
account an admin connected once in the Admin panel.
"""

import io
import os
import re
import secrets
from datetime import datetime, timezone

# Google sometimes returns scopes in a different order (or bundles "openid" into
# the token differently) than what was requested; without this, oauthlib raises
# a scope-mismatch error even though the authorization is perfectly valid.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

from flask import current_app
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from .extensions import db
from .models import Delivery, DriveOAuthState, GoogleDriveAccount, Project

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    # drive.file alone can't list which Shared Drives exist (it only covers
    # files/folders the app itself created) — this adds read-only access to
    # Drive *metadata* (names, structure, shared drives) without granting
    # access to file contents beyond what drive.file already allows.
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]
ROOT_FOLDER_NAME = "SiteVerify Bills"
FOLDER_MIME = "application/vnd.google-apps.folder"


class DriveNotConnected(Exception):
    pass


def _flow() -> Flow:
    client_config = {
        "web": {
            "client_id": current_app.config["GOOGLE_CLIENT_ID"],
            "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [current_app.config["GOOGLE_REDIRECT_URI"]],
        }
    }
    return Flow.from_client_config(
        client_config, scopes=SCOPES, redirect_uri=current_app.config["GOOGLE_REDIRECT_URI"]
    )


def get_authorization_url(admin_id: int) -> str:
    flow = _flow()
    state = secrets.token_urlsafe(24)
    url, _state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # forces a refresh_token even on a repeat connect
        state=state,
    )
    # /drive/connect and /drive/callback are two separate HTTP requests, so the
    # PKCE code_verifier the Flow just generated has to be handed off some other
    # way — stash it in the DB, keyed by the state value Google will echo back.
    db.session.add(DriveOAuthState(state=state, code_verifier=flow.code_verifier, admin_id=admin_id))
    db.session.commit()
    return url


def get_account() -> GoogleDriveAccount | None:
    return GoogleDriveAccount.query.first()


def exchange_code(code: str, state: str) -> GoogleDriveAccount:
    pending = DriveOAuthState.query.get(state)
    if pending is None:
        raise ValueError("This connection attempt expired or was already used — try connecting again")
    connected_by_id = pending.admin_id

    flow = _flow()
    flow.code_verifier = pending.code_verifier
    flow.fetch_token(code=code)
    creds = flow.credentials

    db.session.delete(pending)
    db.session.commit()

    # Pull the email straight out of the ID token's claims (we requested the
    # "openid" scope, so one comes back with the token response) instead of
    # calling the legacy, now-unreliable oauth2 v2 userinfo endpoint.
    email = "unknown"
    if creds.id_token:
        claims = google_id_token.verify_oauth2_token(
            creds.id_token, google_requests.Request(), current_app.config["GOOGLE_CLIENT_ID"]
        )
        email = claims.get("email", "unknown")

    account = get_account() or GoogleDriveAccount(connected_by_id=connected_by_id)
    account.email = email
    account.refresh_token = creds.refresh_token
    account.connected_by_id = connected_by_id
    account.connected_at = datetime.now(timezone.utc)
    account.root_folder_id = None  # in case of a scope change: re-derive it below
    if account.id is None:
        db.session.add(account)
    db.session.commit()

    # Create the root folder, and one subfolder per existing project, right
    # away — rather than waiting for the first "Save to Drive" per project —
    # so the admin sees the full project list in Drive immediately.
    service = build("drive", "v3", credentials=creds)
    _ensure_root_folder(service, account)
    for project in Project.query.all():
        _ensure_project_folder(service, account, project)

    return account


def disconnect() -> None:
    account = get_account()
    if account:
        db.session.delete(account)
        db.session.commit()


def _service():
    account = get_account()
    if account is None:
        raise DriveNotConnected("No Google account connected yet")

    creds = Credentials(
        token=None,
        refresh_token=account.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=current_app.config["GOOGLE_CLIENT_ID"],
        client_secret=current_app.config["GOOGLE_CLIENT_SECRET"],
        # Deliberately no `scopes=` here: a refresh token already carries the
        # scopes it was granted with server-side, and explicitly re-requesting
        # them on refresh makes Google reject the request with "invalid_scope"
        # if it doesn't match exactly (e.g. right after adding a new scope).
    )
    return build("drive", "v3", credentials=creds)


def _shared_drive_kwargs(account: GoogleDriveAccount) -> dict:
    """Extra params list/create calls need when working inside a Shared Drive
    (harmless no-ops when the account is using its own My Drive instead)."""
    kwargs = {"supportsAllDrives": True, "includeItemsFromAllDrives": True}
    if account.shared_drive_id:
        kwargs["corpora"] = "drive"
        kwargs["driveId"] = account.shared_drive_id
    return kwargs


def list_shared_drives() -> list[dict]:
    service = _service()
    res = service.drives().list(pageSize=100, fields="drives(id, name)").execute()
    return res.get("drives", [])


def set_shared_drive(drive_id: str | None, name: str | None) -> GoogleDriveAccount:
    account = get_account()
    if account is None:
        raise DriveNotConnected("No Google account connected yet")

    account.shared_drive_id = drive_id
    account.shared_drive_name = name
    account.root_folder_id = None  # re-create the root folder in the new location
    # Existing per-project folder IDs pointed at the old location — clear them
    # so each project's folder gets (re)created under the new one on next use.
    Project.query.update({Project.drive_folder_id: None})
    db.session.commit()

    service = _service()
    _ensure_root_folder(service, account)
    for project in Project.query.all():
        _ensure_project_folder(service, account, project)

    return account


def _find_folder(service, account: GoogleDriveAccount, name: str, parent_id: str | None) -> str | None:
    query = f"mimeType='{FOLDER_MIME}' and name='{_escape(name)}' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    res = (
        service.files()
        .list(q=query, fields="files(id)", pageSize=1, **_shared_drive_kwargs(account))
        .execute()
    )
    files = res.get("files", [])
    return files[0]["id"] if files else None


def _create_folder(service, account: GoogleDriveAccount, name: str, parent_id: str | None) -> str:
    metadata = {"name": name, "mimeType": FOLDER_MIME}
    if parent_id:
        metadata["parents"] = [parent_id]
    folder = service.files().create(body=metadata, fields="id", supportsAllDrives=True).execute()
    return folder["id"]


def _escape(name: str) -> str:
    return name.replace("'", "\\'")


def _ensure_root_folder(service, account: GoogleDriveAccount) -> str:
    if account.root_folder_id:
        return account.root_folder_id

    # Inside a Shared Drive, the drive's own id doubles as the root "folder" to
    # parent things under; for My Drive, a plain top-level folder (no parent).
    parent_id = account.shared_drive_id
    folder_id = _find_folder(service, account, ROOT_FOLDER_NAME, parent_id) or _create_folder(
        service, account, ROOT_FOLDER_NAME, parent_id
    )
    account.root_folder_id = folder_id
    db.session.commit()
    return folder_id


def _ensure_project_folder(service, account: GoogleDriveAccount, project: Project) -> str:
    if project.drive_folder_id:
        return project.drive_folder_id

    root_id = _ensure_root_folder(service, account)
    folder_name = f"{project.code} — {project.name}"
    folder_id = _find_folder(service, account, folder_name, root_id) or _create_folder(
        service, account, folder_name, root_id
    )
    project.drive_folder_id = folder_id
    db.session.commit()
    return folder_id


def ensure_all_project_folders() -> None:
    """Creates a Drive folder for every project that doesn't have one yet —
    called right after connecting (or switching Shared Drive) so the full
    project list shows up in Drive immediately, not just projects that happen
    to already have a bill saved."""
    account = get_account()
    if account is None:
        return
    service = _service()
    for project in Project.query.all():
        _ensure_project_folder(service, account, project)


def ensure_project_folder_now(project: Project) -> None:
    """Same idea, for a single project — called right when a new project is
    created, so its Drive folder exists immediately rather than waiting for
    the first bill saved to it."""
    account = get_account()
    if account is None:
        return
    service = _service()
    _ensure_project_folder(service, account, project)


def _slugify(text: str) -> str:
    text = re.sub(r"[^A-Za-z0-9]+", "", text)
    return text[:40] or "delivery"


def build_filename(project: Project, delivery: Delivery, sequence: int, ext: str) -> str:
    date_str = delivery.uploaded_at.strftime("%Y-%m-%d")
    vendor_part = _slugify(delivery.vendor)
    return f"{project.code}-{sequence:03d}-{vendor_part}-{date_str}.{ext}"


def upload_delivery_photo(project: Project, delivery: Delivery) -> Delivery:
    if not delivery.photo_filename:
        raise ValueError("This delivery has no photo to save")

    account = get_account()
    if account is None:
        raise DriveNotConnected("No Google account connected yet")

    service = _service()
    folder_id = _ensure_project_folder(service, account, project)

    ext = delivery.photo_filename.rsplit(".", 1)[-1].lower() if "." in delivery.photo_filename else "jpg"
    sequence = project.drive_next_sequence
    filename = build_filename(project, delivery, sequence, ext)

    local_path = current_app.config["UPLOAD_DIR"] / delivery.photo_filename
    with open(local_path, "rb") as f:
        data = f.read()

    media = MediaIoBaseUpload(io.BytesIO(data), mimetype=f"image/{ext if ext != 'jpg' else 'jpeg'}")
    file = (
        service.files()
        .create(
            body={"name": filename, "parents": [folder_id]},
            media_body=media,
            fields="id, webViewLink",
            supportsAllDrives=True,
        )
        .execute()
    )

    project.drive_next_sequence = sequence + 1
    delivery.drive_file_id = file["id"]
    delivery.drive_web_view_link = file.get("webViewLink")
    delivery.drive_synced_at = datetime.now(timezone.utc)
    db.session.commit()
    return delivery
