"""Validate the foreign key of EXECUTION_COLLECTE.ID_SOURCE_DONNEE on the existing rows.

Validation takes a lock that lets the reads and writes go on.

Revision ID: 0052
Revises: 0051
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0052"
down_revision: str | None = "0051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE \"EXECUTION_COLLECTE\" "
        "VALIDATE CONSTRAINT fk_execution_collecte_id_source_donnee"
    )


def downgrade() -> None:
    # A validated constraint cannot be made "not validated": drop it and add it back as 0051 did.
    op.execute(
        "ALTER TABLE \"EXECUTION_COLLECTE\" DROP CONSTRAINT fk_execution_collecte_id_source_donnee"
    )
    op.execute(
        "ALTER TABLE \"EXECUTION_COLLECTE\" ADD CONSTRAINT fk_execution_collecte_id_source_donnee "
        "FOREIGN KEY (\"ID_SOURCE_DONNEE\") REFERENCES \"R_SOURCE_DONNEE\" (\"ID\") "
        "ON DELETE RESTRICT NOT VALID"
    )
