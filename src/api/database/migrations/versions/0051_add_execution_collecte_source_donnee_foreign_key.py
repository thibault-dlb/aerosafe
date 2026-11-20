"""Add the foreign key of EXECUTION_COLLECTE.ID_SOURCE_DONNEE, not validated yet.

NOT VALID checks only the new rows, so the lock is brief; 0052 validates the existing ones.

Revision ID: 0051
Revises: 0050
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0051"
down_revision: str | None = "0050"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE \"EXECUTION_COLLECTE\" ADD CONSTRAINT fk_execution_collecte_id_source_donnee "
        "FOREIGN KEY (\"ID_SOURCE_DONNEE\") REFERENCES \"R_SOURCE_DONNEE\" (\"ID\") "
        "ON DELETE RESTRICT NOT VALID"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE \"EXECUTION_COLLECTE\" DROP CONSTRAINT fk_execution_collecte_id_source_donnee"
    )
