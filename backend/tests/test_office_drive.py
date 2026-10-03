import pytest

from siteverify.extensions import db
from siteverify.models import GoogleDriveAccount, Project, User

from conftest import PHONES


def connect_fake_drive(app):
    with app.app_context():
        admin = User.query.filter_by(phone=PHONES["admin"]).first()
        db.session.add(
            GoogleDriveAccount(
                email="bills@example.com",
                refresh_token="secret-refresh-token",
                root_folder_id="root123",
                shared_drive_id="sd1",
                shared_drive_name="Sustaniq Bills",
                connected_by_id=admin.id,
            )
        )
        db.session.get(Project, "kh-014").drive_folder_id = "folder014"
        db.session.commit()


def test_supervisors_cannot_see_drive_links(client, login):
    assert client.get("/api/office/drive").status_code == 401
    assert client.get("/api/office/drive", headers=login("supervisor")).status_code == 403


@pytest.mark.parametrize("role", ["accountant", "admin"])
def test_not_connected_is_reported(client, login, role):
    res = client.get("/api/office/drive", headers=login(role))
    assert res.status_code == 200
    assert res.get_json() == {"connected": False}


@pytest.mark.parametrize("role", ["accountant", "admin"])
def test_connected_drive_links_without_secrets(app, client, login, role):
    connect_fake_drive(app)
    res = client.get("/api/office/drive", headers=login(role))
    body = res.get_json()

    assert body["connected"] is True
    assert body["sharedDriveName"] == "Sustaniq Bills"
    assert body["rootFolderUrl"] == "https://drive.google.com/drive/folders/root123"
    assert body["projectFolderUrls"] == {"kh-014": "https://drive.google.com/drive/folders/folder014"}
    assert "secret-refresh-token" not in res.get_data(as_text=True)


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/admin/drive/connect"),
        ("post", "/api/admin/drive/disconnect"),
        ("get", "/api/admin/drive/shared-drives"),
        ("post", "/api/admin/drive/shared-drive"),
    ],
)
def test_accountants_still_cannot_change_the_drive_connection(client, login, method, path):
    res = getattr(client, method)(path, headers=login("accountant"), json={})
    assert res.status_code == 403
