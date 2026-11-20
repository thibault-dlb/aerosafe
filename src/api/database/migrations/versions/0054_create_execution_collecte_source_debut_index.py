"""Index EXECUTION_COLLECTE on (ID_SOURCE_DONNEE, DT_DEBUT).

The source is a foreign key, which PostgreSQL does not index by itself, and the dashboard reads
the latest cycles of one source: the pair serves both. Built concurrently, outside a
transaction, so the collectors keep writing (as for 0041).

Revision ID: 0054
Revises: 0053
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0054"
down_revision: str | None = "0053"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY idx_execution_collecte_source_debut "
            'ON "EXECUTION_COLLECTE" ("ID_SOURCE_DONNEE", "DT_DEBUT")'
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY idx_execution_collecte_source_debut")
