from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from siteverify.extensions import db


def test_migrations_match_the_models(app):
    # Fails if someone changes models.py without generating a migration
    # (flask db migrate), which would otherwise only surface as a production error.
    with app.app_context():
        with db.engine.connect() as conn:
            diff = compare_metadata(MigrationContext.configure(conn), db.metadata)
    assert diff == []
