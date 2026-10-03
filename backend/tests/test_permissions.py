import pytest

ADMIN_ONLY = [
    ("get", "/api/admin/overview"),
    ("get", "/api/admin/deliveries"),
    ("get", "/api/admin/users"),
    ("post", "/api/admin/users"),
    ("get", "/api/admin/password-resets"),
    ("post", "/api/admin/projects"),
    ("get", "/api/admin/drive/status"),
    ("post", "/api/admin/drive/disconnect"),
]

LOGGED_IN_ONLY = [
    ("get", "/api/projects"),
    ("get", "/api/projects/kh-014"),
    ("get", "/api/projects/kh-014/deliveries"),
    ("get", "/api/office/stats"),
    ("get", "/uploads/anything.jpg"),
]


@pytest.mark.parametrize("method,path", ADMIN_ONLY + LOGGED_IN_ONLY)
def test_anonymous_requests_are_rejected(client, method, path):
    assert getattr(client, method)(path).status_code == 401


@pytest.mark.parametrize("role", ["supervisor", "accountant"])
@pytest.mark.parametrize("method,path", ADMIN_ONLY)
def test_non_admins_cannot_use_admin_endpoints(client, login, role, method, path):
    res = getattr(client, method)(path, headers=login(role), json={})
    assert res.status_code == 403


def test_admin_can_use_admin_endpoints(client, login):
    assert client.get("/api/admin/overview", headers=login("admin")).status_code == 200
