"""Make AERONEF.ID_SOURCE_DONNEE NOT NULL, without a scan of the table under a full lock.

`SET NOT NULL` alone reads the whole table while it holds the strongest lock. With a validated
`CHECK (... IS NOT NULL)` already in place, PostgreSQL 12 and later skips that read: the check is
added without validation, validated under a light lock, then the column is set and the check
dropped, being now redundant.

Revision ID: 0040
Revises: 0039
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0040"
down_revision: str | None = "0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE \"AERONEF\" ADD CONSTRAINT ck_aeronef_source_donnee_renseignee "
        "CHECK (\"ID_SOURCE_DONNEE\" IS NOT NULL) NOT VALID"
    )
    op.execute("ALTER TABLE \"AERONEF\" VALIDATE CONSTRAINT ck_aeronef_source_donnee_renseignee")
    op.execute("ALTER TABLE \"AERONEF\" ALTER COLUMN \"ID_SOURCE_DONNEE\" SET NOT NULL")
    op.execute("ALTER TABLE \"AERONEF\" DROP CONSTRAINT ck_aeronef_source_donnee_renseignee")


def downgrade() -> None:
    op.execute("ALTER TABLE \"AERONEF\" ALTER COLUMN \"ID_SOURCE_DONNEE\" DROP NOT NULL")
