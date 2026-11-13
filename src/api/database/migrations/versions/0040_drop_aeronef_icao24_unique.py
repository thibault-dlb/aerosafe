"""Drop the uniqueness of AERONEF.CD_ICAO24 alone, replaced by 0039.

The downgrade fails if two aircraft of different sources share an address: remove the replayed
aircraft first.

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
    op.execute("ALTER TABLE \"AERONEF\" DROP CONSTRAINT uq_aeronef_cd_icao24")


def downgrade() -> None:
    op.execute("ALTER TABLE \"AERONEF\" ADD CONSTRAINT uq_aeronef_cd_icao24 UNIQUE (\"CD_ICAO24\")")
