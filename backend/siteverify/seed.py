from .extensions import db
from .models import Project, User

DEMO_PASSWORD = "demo1234"


def seed_if_empty():
    """Creates the two demo accounts and the starter project list on first run.

    Deliberately seeds no Delivery rows — those should only ever be real
    uploads made through the app, never fabricated demo history.
    """
    if User.query.first() is not None:
        return

    supervisor = User(name="Ramesh Patil", initials="RP", phone="+91 98200 00001", role="supervisor")
    supervisor.set_password(DEMO_PASSWORD)

    accountant = User(name="Priya Deshmukh", initials="PD", phone="+91 98200 00002", role="accountant")
    accountant.set_password(DEMO_PASSWORD)

    admin = User(name="Vijay", initials="VJ", phone="+91 98200 00009", role="admin")
    admin.set_password(DEMO_PASSWORD)

    db.session.add_all([supervisor, accountant, admin])

    projects = [
        Project(id="kh-014", code="KH-PRJ-014", name="Andheri Metro Depot, Phase 2", accent="accent"),
        Project(id="kh-021", code="KH-PRJ-021", name="Thane Warehouse Extension", accent="forest"),
        Project(id="sus-006", code="SUS-PRJ-006", name="Sustaniq - Kalyan Site Office", accent="clay"),
    ]
    db.session.add_all(projects)
    db.session.commit()
