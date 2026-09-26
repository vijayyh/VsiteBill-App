"""Tiny startup schema patcher.

db.create_all() only creates tables that don't exist yet — it never adds a
column to a table that's already there. That's fine before anything real is
stored, but this app now has a live production database, so from here on any
new column needs to be listed below instead of relying on wiping the DB.

Safe to run on every startup: it only ALTERs a table when it already exists
and is missing the column, on both SQLite (dev) and Postgres (production).
"""

from sqlalchemy import inspect, text

from .extensions import db

# (table, column, DDL type/constraints)
_NEW_COLUMNS = [
    ("projects", "drive_folder_id", "VARCHAR(100)"),
    ("projects", "drive_next_sequence", "INTEGER NOT NULL DEFAULT 1"),
    ("deliveries", "drive_file_id", "VARCHAR(100)"),
    ("deliveries", "drive_web_view_link", "VARCHAR(500)"),
    ("deliveries", "drive_synced_at", "TIMESTAMP"),
    ("google_drive_account", "shared_drive_id", "VARCHAR(100)"),
    ("google_drive_account", "shared_drive_name", "VARCHAR(255)"),
]


def run():
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())

    for table, column, ddl_type in _NEW_COLUMNS:
        if table not in existing_tables:
            continue  # create_all() will create the whole table, this column included
        columns = {c["name"] for c in inspector.get_columns(table)}
        if column in columns:
            continue
        with db.engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
