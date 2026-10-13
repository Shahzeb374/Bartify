"""Create the reference roles required by signup and administrator checks."""
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.models import Role


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
