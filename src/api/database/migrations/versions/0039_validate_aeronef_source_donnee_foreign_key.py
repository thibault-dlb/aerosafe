"""Validate the foreign key AERONEF.ID_SOURCE_DONNEE on the rows that already exist.

`VALIDATE CONSTRAINT` scans the table under a lock that lets reads and writes go on.

Revision ID: 0039
Revises: 0038
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0039"
down_revision: str | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE \"AERONEF\" VALIDATE CONSTRAINT fk_aeronef_id_source_donnee")


def downgrade() -> None:
    # A validated constraint cannot be made "not validated": drop it and add it back as 0038 did.
    op.execute("ALTER TABLE \"AERONEF\" DROP CONSTRAINT fk_aeronef_id_source_donnee")
    op.execute(
        "ALTER TABLE \"AERONEF\" ADD CONSTRAINT fk_aeronef_id_source_donnee "
        "FOREIGN KEY (\"ID_SOURCE_DONNEE\") REFERENCES \"R_SOURCE_DONNEE\" (\"ID\") "
        "ON DELETE RESTRICT NOT VALID"
    )
