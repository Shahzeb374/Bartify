"""Create the reference roles required by signup and administrator checks."""
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.models import Role
from sqlalchemy import inspect, text


def ensure_session_version(engine):
    """Upgrade existing installations without changing existing sessions."""
    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0"))
        elif "session_version" not in {c["name"] for c in inspect(connection).get_columns("users")}:
            connection.execute(text("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0"))


def ensure_default_roles(engine):
    # Fixed IDs are part of the existing authentication contract. Never update
    # existing roles or user assignments. Conflict handling also supports
    # simultaneous application startups.
    insert = postgres_insert if engine.dialect.name == "postgresql" else sqlite_insert
    statement = insert(Role.__table__).values([
        {"r_id": 1, "role": "Member"},
        {"r_id": 2, "role": "Admin"},
    ]).on_conflict_do_nothing(index_elements=["r_id"])
    with engine.begin() as connection:
        connection.execute(statement)
