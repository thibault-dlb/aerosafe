"""Add the foreign key AERONEF.ID_SOURCE_DONNEE to R_SOURCE_DONNEE, without checking the rows yet.

`NOT VALID` takes the constraint into account for new rows at once and does not scan the table,
so the lock is brief. 0039 validates the existing rows, under a lock that lets reads and writes
go on.

Revision ID: 0038
Revises: 0037
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0038"
down_revision: str | None = "0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE \"AERONEF\" ADD CONSTRAINT fk_aeronef_id_source_donnee "
        "FOREIGN KEY (\"ID_SOURCE_DONNEE\") REFERENCES \"R_SOURCE_DONNEE\" (\"ID\") "
        "ON DELETE RESTRICT NOT VALID"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE \"AERONEF\" DROP CONSTRAINT fk_aeronef_id_source_donnee")
