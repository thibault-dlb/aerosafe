"""Drop the EXECUTION_COLLECTE (ID_STATUT_COLLECTE) index, covered by 0031.

ID_STATUT_COLLECTE is the first column of idx_execution_collecte_statut_debut, so its foreign
key stays indexed.

Revision ID: 0032
Revises: 0031
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY idx_execution_collecte_statut")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY idx_execution_collecte_statut "
            'ON "EXECUTION_COLLECTE" ("ID_STATUT_COLLECTE")'
        )
