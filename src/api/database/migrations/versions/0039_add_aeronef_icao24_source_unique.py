"""Make an ICAO24 address unique for each source of data, not across all of them.

The aircraft of a replayed dataset get synthetic codes (a flight identifier written in six
hexadecimal digits), which can equal the address of a real aircraft collected live. The new
constraint is added first and 0040 drops the old one, so the table is never left without a key.

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
    op.execute(
        "ALTER TABLE \"AERONEF\" ADD CONSTRAINT uq_aeronef_cd_icao24_id_source_donnee "
        "UNIQUE (\"CD_ICAO24\", \"ID_SOURCE_DONNEE\")"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE \"AERONEF\" DROP CONSTRAINT uq_aeronef_cd_icao24_id_source_donnee")
