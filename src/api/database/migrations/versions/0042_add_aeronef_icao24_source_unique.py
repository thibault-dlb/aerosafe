"""Make an ICAO24 address unique for each source of data, not across all of them.

The aircraft of a replayed dataset get synthetic codes (a flight identifier written in six
hexadecimal digits), which can equal the address of a real aircraft collected live. The new
constraint is added first and 0043 drops the old one, so the table is never left without a key.
The unique index is built concurrently, then becomes the constraint with `USING INDEX`, which
takes no scan and only a brief lock.

Revision ID: 0042
Revises: 0041
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0042"
down_revision: str | None = "0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE UNIQUE INDEX CONCURRENTLY uq_aeronef_cd_icao24_id_source_donnee "
            'ON "AERONEF" ("CD_ICAO24", "ID_SOURCE_DONNEE")'
        )
        op.execute(
            "ALTER TABLE \"AERONEF\" ADD CONSTRAINT uq_aeronef_cd_icao24_id_source_donnee "
            "UNIQUE USING INDEX uq_aeronef_cd_icao24_id_source_donnee"
        )


def downgrade() -> None:
    op.execute("ALTER TABLE \"AERONEF\" DROP CONSTRAINT uq_aeronef_cd_icao24_id_source_donnee")
