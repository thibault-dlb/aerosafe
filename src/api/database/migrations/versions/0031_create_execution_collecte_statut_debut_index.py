"""Index EXECUTION_COLLECTE on (ID_STATUT_COLLECTE, DT_DEBUT) for the latest successful run.

The last successful run filters on the status and sorts by DT_DEBUT. With only the DT_DEBUT
index, PostgreSQL reads back through every SKIPPED or RATE_LIMITED run first. Built
concurrently, outside a transaction, so the collector keeps writing.

Revision ID: 0031
Revises: 0030
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY idx_execution_collecte_statut_debut "
            'ON "EXECUTION_COLLECTE" ("ID_STATUT_COLLECTE", "DT_DEBUT")'
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY idx_execution_collecte_statut_debut")
