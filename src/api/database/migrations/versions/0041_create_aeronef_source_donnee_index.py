"""Index AERONEF.ID_SOURCE_DONNEE, a foreign key.

PostgreSQL does not index foreign keys by itself, and the unique pair of 0042 starts with
`CD_ICAO24`, so it does not serve a filter on the source. Built concurrently, outside a
transaction, so the writes on AERONEF go on (as for 0034).

Revision ID: 0041
Revises: 0040
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0041"
down_revision: str | None = "0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY idx_aeronef_source_donnee "
            'ON "AERONEF" ("ID_SOURCE_DONNEE")'
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY idx_aeronef_source_donnee")
